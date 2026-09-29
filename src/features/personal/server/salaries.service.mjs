import crypto from 'node:crypto';
import { fail } from '#core/server/errors/domain-error.mjs';
import { sha256Hex } from '#core/server/persistence/content-digest.mjs';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { today as localToday, monthOK } from '#shared/domain/calendar-month.mjs';
import { GENERAL_CATEGORY_NAME } from '#shared/domain/expense-categories.mjs';
import { normalizePersonalRecord, isStaffInBranch } from '../domain/personal-schema.mjs';
import { salaryForMonth, salaryEntryFor } from '../domain/salary-computation.mjs';
import { summarizeTimesheetMonth, timesheetKey } from '../domain/timesheet-month.mjs';

// m8: numele categoriei se citește după id fix (semințele din expense-category-seeding.mjs),
// nu e un literal — dacă operatorul a redenumit sau șters „Salarii”, cheltuiala cade pe General
// în loc să creeze o categorie-text orfană.
const SALARY_CATEGORY_ID = 'CAT-salarii';

/** @typedef {import('../personal.types.d.mts').Staff} Staff */
/** @typedef {import('./personal.repository.mjs').PersonalRepository} PersonalRepository */

/** @param {string} month YYYY-MM */
function nextMonth(month) {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7));
  return monthIndex === 12 ? `${year + 1}-01` : `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

/**
 * Salariile, avansurile și plata lor (decizia 6–7 din plan; audit B — C1, M1, M2, M4, M5, M11).
 * Cele două fișiere (filiala activă și baza comună) nu pot împărți o tranzacție: `runRevisionTransaction`
 * al filialei rulează primul, iar în interiorul lui, ca ULTIM pas, toate scrierile din `comun` ale
 * lotului curent se fac într-o singură `personalRepository.kinds.transaction(...)`, atomic — fie
 * toate, fie niciuna. Tot lotul e validat înainte de a deschide vreo tranzacție (rând calculat,
 * net > 0, cheltuiala validă): o eroare pe un angajat refuză tot lotul, cu numele lui în mesaj, nu
 * lasă alți angajați parțial plătiți. „Plătit” = rândul `salary_payments` ȘI cheltuiala lui,
 * nearhivată — un `salary_payments` orfan (cheltuiala lipsă) se tratează ca neplătit și se rescrie.
 * @param {{
 *   personalRepository: PersonalRepository,
 *   branchId: string,
 *   recordRepository: import('#shared/contracts/persistence.mjs').RecordRepository,
 *   runRevisionTransaction: import('#shared/contracts/persistence.mjs').RunRevisionTransaction,
 *   auditTrail: import('#shared/contracts/audit-trail.mjs').AuditTrail,
 *   readCoachPayForMonth?: (staffId: string, month: string) => unknown,
 *   today?: () => string,
 * }} dependencies
 */
export function createSalariesService({
  personalRepository,
  branchId,
  recordRepository,
  runRevisionTransaction,
  auditTrail,
  readCoachPayForMonth = () => null,
  today = localToday,
}) {
  /** @returns {string} */
  function expenseCategoryName() {
    const category = recordRepository.find('categories', SALARY_CATEGORY_ID);
    return category ? category.name : GENERAL_CATEGORY_NAME;
  }

  /**
   * „Plătit” = rândul `salary_payments` ȘI cheltuiala lui existentă, nearhivată (C1 punctul 3) —
   * altfel o scriere ruptă ar ascunde bani în loc să arate „De plătit”.
   * @param {string} staffId @param {string} month @returns {import('../personal.types.d.mts').SalaryPayment | null}
   */
  function validPayment(staffId, month) {
    const paymentId = personalRepository.salaryPaymentId(staffId, month, branchId);
    const payment = personalRepository.kinds.find('salary_payments', paymentId);
    if (!payment) return null;
    const expense = recordRepository.find('expenses', payment.expenseId);
    return expense && !expense.archived ? payment : null;
  }

  /**
   * Un avans e „scăzut” doar dacă plata care l-a scăzut e ea însăși validă (C1) — altfel banii
   * marcați scăzuți către o plată orfană nu ar mai apărea nicăieri (M11 / scenariul din raport).
   * @param {import('../personal.types.d.mts').Advance} advance
   */
  function isAdvanceDeducted(advance) {
    if (!advance.deductedAt || !advance.deductedBy) return false;
    const payment = personalRepository.kinds.find('salary_payments', advance.deductedBy);
    if (!payment) return false;
    const expense = recordRepository.find('expenses', payment.expenseId);
    return !!(expense && !expense.archived);
  }

  /** @param {string} month @param {string} staffId */
  function undeductedAdvances(month, staffId) {
    return personalRepository.advancesForMonth(month, [staffId]).filter(advance => !isAdvanceDeducted(advance));
  }

  /** @param {Staff} staff @param {string} month @param {import('../personal.types.d.mts').PersonalSettings} settings @param {string} todayStr */
  function rowForStaff(staff, month, settings, todayStr) {
    const salary = salaryEntryFor(personalRepository.salariesForStaff(staff.id), staff.id, month);
    // A3f (24-personal.md #23c): rândul apare oricum — „Baza lunii” arată „+ Setează salariul”,
    // nebifabil — nu mai dispare din listă un angajat căruia nu i s-a setat încă salariul.
    if (!salary)
      return {
        staff,
        mode: null,
        base: '',
        gross: null,
        advances: 0,
        net: null,
        paid: null,
        deductible: 0,
        estimated: false,
      };
    const monthHasEnded = month < todayStr.slice(0, 7);
    const rows = new Map(
      personalRepository.timesheetForMonth(month, [staff.id]).map(row => [timesheetKey(staff.id, row.date), row]),
    );
    // M4: luna curentă (necheiată) se calculează doar până azi — restul lunii nu e „lucrat” încă.
    const timesheetRow = summarizeTimesheetMonth({
      staff,
      month,
      rows,
      todayStr,
      upTo: monthHasEnded ? 'month' : 'today',
    });
    const coachPay =
      salary.mode === 'bazin'
        ? /** @type {{ amount: number, rate: number, sessionsHeld: number, childrenPresent: number, mode: 'per_child' | 'per_session' } | null} */ (
            readCoachPayForMonth(staff.id, month)
          )
        : null;
    const { gross, base, deductible } = salaryForMonth({ salary, timesheetRow, settings, coachPay });
    const payment = validPayment(staff.id, month);
    if (payment) {
      // M1: sursa de adevăr, o dată plătit, e plata efectivă — nu recalculul curent al
      // avansurilor (care ar fi deja scăzute și ar arăta net = brut).
      const advancesTotal = payment.advances.reduce((sum, advanceId) => {
        const advance = personalRepository.kinds.find('advances', advanceId);
        return sum + (advance ? advance.amount : 0);
      }, 0);
      return {
        staff,
        mode: salary.mode,
        base,
        gross,
        advances: advancesTotal,
        net: payment.amount,
        paid: { branchId: payment.branchId, paidAt: payment.paidAt },
        deductible,
        estimated: false,
      };
    }
    const advancesTotal = undeductedAdvances(month, staff.id).reduce((sum, advance) => sum + advance.amount, 0);
    const net = gross === null ? null : Math.max(0, Math.round((gross - advancesTotal) * 100) / 100);
    return {
      staff,
      mode: salary.mode,
      base,
      gross,
      advances: advancesTotal,
      net,
      paid: null,
      deductible,
      estimated: !monthHasEnded,
    };
  }

  /** @param {string} month @returns {{ rows: ReturnType<typeof rowForStaff>[], totals: { gross: number, advances: number, net: number, paid: number }, estimated: boolean }} */
  function listMonth(month) {
    const settings = personalRepository.readSettings();
    const todayStr = today();
    const rows = personalRepository
      .staffForBranch(branchId)
      .filter(staff => !staff.archivedAt)
      .map(staff => rowForStaff(staff, month, settings, todayStr));
    const totals = rows.reduce(
      (totals, row) => ({
        gross: totals.gross + (row.gross || 0),
        advances: totals.advances + row.advances,
        net: totals.net + (row.net || 0),
        paid: totals.paid + (row.paid ? row.net || 0 : 0),
      }),
      { gross: 0, advances: 0, net: 0, paid: 0 },
    );
    return { rows, totals, estimated: month >= todayStr.slice(0, 7) };
  }

  /**
   * M11: un avans dat pentru o lună deja plătită nu se mai poate scădea din plata aceea (nu
   * mai există) — se mută automat pe luna următoare, ca să fie scăzut la plata ei, niciodată
   * pierdut și niciodată scăzut de două ori. Id determinist din `requestId` (m19): o reluare
   * după o cădere de rețea găsește avansul deja scris, nu mai creează unul nou fantomă.
   * @param {{ staffId: string, date: string, amount: number, method: string, month: string, revision: number, requestId: string }} input
   */
  function giveAdvance({ staffId, date, amount, method, month, revision, requestId }) {
    const staff = personalRepository.kinds.find('staff', staffId);
    if (!staff) fail('Angajatul nu mai există.', 409);
    if (!isStaffInBranch(staff, branchId)) fail(`${staff.name}: nu lucrează la filiala activă.`, 409);
    const advanceMonth = validPayment(staffId, month) ? nextMonth(month) : month;
    // m19: id determinist din `requestId` (lungime fixă, prin hash — requestId poate avea până
    // la 100 de caractere) — o reluare după o cădere de rețea găsește avansul deja scris.
    const advanceId = `ADV-${sha256Hex(requestId).slice(0, 32)}`;
    const expenseId = `EXP-avans-${advanceId}`;
    const envelope = runRevisionTransaction(
      { revision, requestId },
      { action: 'avans salariu', backupBefore: false },
      () => {
        // m11 (24-personal:37): descrierea NU poartă numele — cheltuiala e vizibilă în
        // Cheltuieli/Istoric fără PIN (decizia 7/8 din plan), dar identitatea angajatului
        // rămâne în spatele cortinei; suma agregată de „Salarii” tot intră corect în conturi.
        const expense = normalizeRecord('expenses', {
          id: expenseId,
          date,
          category: expenseCategoryName(),
          method,
          description: `Avans ${advanceMonth}`,
          amount,
        });
        recordRepository.save('expenses', expense);
        auditTrail.recordChange({
          action: 'adăugare',
          recordType: 'expenses',
          recordId: expense.id,
          before: null,
          after: expense,
        });
        const advance = normalizePersonalRecord('advances', {
          id: advanceId,
          staffId,
          date,
          amount,
          method,
          month: advanceMonth,
          expenseId,
          deductedAt: null,
          deductedBy: null,
        });
        personalRepository.kinds.save('advances', advance);
      },
    );
    return {
      ...envelope,
      advance: personalRepository.kinds.find('advances', advanceId),
      movedToNextMonth: advanceMonth !== month,
    };
  }

  /** @param {{ id: string, revision: number, requestId: string }} input */
  function removeAdvance({ id, revision, requestId }) {
    const advance = personalRepository.kinds.find('advances', id);
    if (!advance) fail('Avansul nu mai există.', 409);
    if (advance.deductedAt) fail('Avansul a fost deja scăzut la o plată — nu se mai poate șterge.');
    return runRevisionTransaction({ revision, requestId }, { action: 'ștergere avans', backupBefore: false }, () => {
      const expense = recordRepository.find('expenses', advance.expenseId);
      if (expense && !expense.archived) {
        const archived = { ...expense, archived: true, archivedAt: new Date().toISOString() };
        recordRepository.save('expenses', archived);
        auditTrail.recordChange({
          action: 'arhivare',
          recordType: 'expenses',
          recordId: expense.id,
          before: expense,
          after: archived,
        });
      }
      personalRepository.kinds.remove('advances', id);
    });
  }

  /**
   * O plată = o cheltuială determinist `EXP-salariu-<staffId>-<month>` plus rândul
   * `salary_payments` — a doua plată e no-op (`skipped`). Tot lotul e calculat și validat
   * ÎNAINTE de a deschide vreo tranzacție (C1); scrierile din `comun` ale lotului se fac
   * o singură dată, ca ultim pas, într-o singură tranzacție atomică.
   * @param {{ staffIds: string[], month: string, method: string, date: string, revision: number, requestId: string }} input
   */
  function pay({ staffIds, month, method, date, revision, requestId }) {
    if (!Array.isArray(staffIds) || staffIds.length === 0) fail('Nu a fost selectat niciun angajat.');
    if (!monthOK(month)) fail('Lună invalidă.');
    const todayStr = today();
    // M4: o lună care nu s-a încheiat nu se poate plăti — absențele ei nu sunt încă definitive.
    if (month >= todayStr.slice(0, 7)) fail('Luna nu s-a încheiat.');
    const settings = personalRepository.readSettings();
    const staffList = staffIds.map(id => {
      const staff = personalRepository.kinds.find('staff', id);
      if (!staff) fail('Angajat inexistent.', 409);
      // M5: un angajat al celeilalte filiale nu se poate plăti din filiala activă.
      if (!isStaffInBranch(staff, branchId)) fail(`${staff.name}: nu lucrează la filiala activă.`, 409);
      return staff;
    });

    const plans = [];
    const alreadyPaid = [];
    for (const staff of staffList) {
      if (validPayment(staff.id, month)) {
        alreadyPaid.push(staff.id);
        continue;
      }
      const salary = salaryEntryFor(personalRepository.salariesForStaff(staff.id), staff.id, month);
      if (!salary) fail(`${staff.name}: nu are salariu setat pentru ${month}.`);
      if (salary.mode === 'bazin') fail(`${staff.name}: salariul se plătește din Bazin.`);
      const row = rowForStaff(staff, month, settings, todayStr);
      if (!row || row.gross === null || row.net === null)
        fail(`${staff.name}: salariul nu poate fi calculat pentru ${month}.`);
      // M2: avansurile pot acoperi tot salariul — nimic de plătit, dar mesajul trebuie să spună de ce.
      if (row.net <= 0) fail(`${staff.name}: avansurile acoperă salariul — nimic de plătit.`);
      const paymentId = personalRepository.salaryPaymentId(staff.id, month, branchId);
      const expenseId = `EXP-salariu-${staff.id}-${month}`;
      // m11 (24-personal:37): fără numele angajatului — vezi comentariul din giveAdvance.
      const expense = normalizeRecord('expenses', {
        id: expenseId,
        date,
        category: expenseCategoryName(),
        method,
        description: `Salariu ${month}`,
        amount: row.net,
      });
      const undeducted = undeductedAdvances(month, staff.id);
      const payment = normalizePersonalRecord('salary_payments', {
        id: paymentId,
        staffId: staff.id,
        month,
        branchId,
        mode: row.mode,
        amount: row.net,
        advances: undeducted.map(advance => advance.id),
        expenseId,
        paidAt: new Date().toISOString(),
      });
      plans.push({ staff, expense, payment, undeducted });
    }

    const envelope = runRevisionTransaction(
      { revision, requestId },
      { action: 'plată salarii', backupBefore: false },
      () => {
        for (const plan of plans) {
          recordRepository.save('expenses', plan.expense);
          auditTrail.recordChange({
            action: 'adăugare',
            recordType: 'expenses',
            recordId: plan.expense.id,
            before: null,
            after: plan.expense,
          });
          // m11 (24-personal:37): suma nu intră în Istoric prin acțiunea dedicată Personal —
          // doar prin cheltuiala generică (inevitabil, orice scriere de cheltuială e auditată
          // integral); aici scriem un rezumat fără `amount`, ca dublura să nu adauge o a doua
          // expunere a sumei în afara PIN-ului.
          auditTrail.recordChange({
            action: 'personal: plată salariu',
            recordType: null,
            recordId: plan.payment.id,
            before: null,
            after: { staffId: plan.payment.staffId, month: plan.payment.month, branchId: plan.payment.branchId },
          });
        }
        // Scrierile din `comun` ale întregului lot, atomic, ca ULTIM pas (C1) — fie toate
        // avansurile și rândurile `salary_payments` se scriu, fie niciuna.
        if (plans.length > 0)
          personalRepository.kinds.transaction(() => {
            for (const plan of plans) {
              for (const advance of plan.undeducted)
                personalRepository.kinds.save('advances', {
                  ...advance,
                  deductedAt: date,
                  deductedBy: plan.payment.id,
                });
              personalRepository.kinds.save('salary_payments', plan.payment);
            }
          });
      },
    );
    // m19: „paid” e lotul calculat înainte de tranzacție (determinist), nu variabile umplute
    // în closure — pe o reluare idempotentă (`replayed: true`) lotul e deja gol (angajații
    // arătau „plătit” încă la verificarea de mai sus), deci rezultatul rămâne corect fără să
    // mai citească nimic din urmă.
    return { ...envelope, paid: plans.map(plan => plan.staff.id), skipped: alreadyPaid };
  }

  /** @param {string} staffId */
  function history(staffId) {
    const payments = personalRepository.kinds.list('salary_payments').filter(payment => payment.staffId === staffId);
    const advances = personalRepository.kinds.list('advances').filter(advance => advance.staffId === staffId);
    const months = new Set([...payments.map(payment => payment.month), ...advances.map(advance => advance.month)]);
    return {
      months: [...months].sort().map(month => ({
        month,
        payment: payments.find(payment => payment.month === month) ?? null,
        advances: advances.filter(advance => advance.month === month),
      })),
    };
  }

  return { listMonth, giveAdvance, removeAdvance, pay, history };
}

/**
 * Portul `payCoach` al Bazinului (decizia 6, 2026-09-27-personal-bazin.md): „Închide luna” scrie
 * singură plata antrenorilor mod `bazin` — `pay()` de mai sus refuză explicit acest mod, pentru
 * că suma vine din Pool (`coachPayForMonth`), nu din pontaj. Aceeași regulă de idempotență
 * (`salary_payments` + cheltuiala ei nearhivată = plătit) și de avansuri (scăzute o singură dată).
 * @param {{
 *   personalRepository: PersonalRepository,
 *   branchId: string,
 *   recordRepository: import('#shared/contracts/persistence.mjs').RecordRepository,
 *   auditTrail: import('#shared/contracts/audit-trail.mjs').AuditTrail,
 * }} dependencies
 */
export function createCoachPaymentWriter({ personalRepository, branchId, recordRepository, auditTrail }) {
  function expenseCategoryName() {
    const category = recordRepository.find('categories', SALARY_CATEGORY_ID);
    return category ? category.name : GENERAL_CATEGORY_NAME;
  }
  /** @param {string} staffId @param {string} month */
  function validPayment(staffId, month) {
    const paymentId = personalRepository.salaryPaymentId(staffId, month, branchId);
    const payment = personalRepository.kinds.find('salary_payments', paymentId);
    if (!payment) return null;
    const expense = recordRepository.find('expenses', payment.expenseId);
    return expense && !expense.archived ? payment : null;
  }
  /** @param {import('../personal.types.d.mts').Advance} advance */
  function isAdvanceDeducted(advance) {
    if (!advance.deductedAt || !advance.deductedBy) return false;
    const payment = personalRepository.kinds.find('salary_payments', advance.deductedBy);
    if (!payment) return false;
    const expense = recordRepository.find('expenses', payment.expenseId);
    return !!(expense && !expense.archived);
  }
  /** @param {string} month @param {string} staffId */
  function undeductedAdvances(month, staffId) {
    return personalRepository.advancesForMonth(month, [staffId]).filter(advance => !isAdvanceDeducted(advance));
  }

  /**
   * Scrie plata antrenorului dacă nu e deja plătit — idempotent, apelabil de câte ori se
   * reînchide luna. Fără cheltuială când suma netă e 0 (avansurile acoperă tot): nimic de plătit
   * încă nu înseamnă „plătit", luna rămâne deschisă pentru acel antrenor la reînchidere.
   *
   * A-4: o reînchidere poate recalcula prezențele antrenorului (o ședință corectată) — `gross`
   * nou nu mai coincide cu plata deja scrisă. Id-ul de plată (`salary_payments`) rămâne același
   * (avansurile deja scăzute rămân legate de el, nu se scad a doua oară), dar cheltuiala veche se
   * arhivează și se scrie una nouă — același tipar ca `removeAdvance` mai sus (arhivare, nu
   * ștergere/suprascriere pe loc, ca istoricul cheltuielilor să rămână corect).
   * @param {{ staffId: string, month: string, gross: number, date: string, method: string }} input
   * @returns {{ paid: boolean, expenseId?: string }}
   */
  function payCoach({ staffId, month, gross, date, method }) {
    const existing = validPayment(staffId, month);
    if (existing) {
      // Avansurile deja scăzute la această plată nu se recalculează — rămân legate de același
      // paymentId, care nu se schimbă la o corecție (decizia „o singură dată”, ca la restul serviciului).
      const advancesTotal = existing.advances.reduce((sum, advanceId) => {
        const advance = personalRepository.kinds.find('advances', advanceId);
        return sum + (advance ? advance.amount : 0);
      }, 0);
      const net = Math.max(0, Math.round((gross - advancesTotal) * 100) / 100);
      if (net === existing.amount) return { paid: false }; // nicio schimbare — reînchidere no-op
      const oldExpense = recordRepository.find('expenses', existing.expenseId);
      if (oldExpense && !oldExpense.archived) {
        const archived = { ...oldExpense, archived: true, archivedAt: new Date().toISOString() };
        recordRepository.save('expenses', archived);
        auditTrail.recordChange({
          action: 'arhivare',
          recordType: 'expenses',
          recordId: oldExpense.id,
          before: oldExpense,
          after: archived,
        });
      }
      if (net <= 0) {
        // Corecția a dus suma la zero (sau sub) — nimic de plătit: cheltuiala veche rămâne
        // arhivată, iar rândul de plată dispare, ca luna să rămână „neplătită” pentru acest
        // antrenor la o reînchidere ulterioară (aceeași regulă ca la prima plată, mai jos).
        personalRepository.kinds.remove('salary_payments', existing.id);
        return { paid: false };
      }
      const expenseId = `EXP-bazin-${staffId}-${month}-${crypto.randomUUID()}`;
      const expense = normalizeRecord('expenses', {
        id: expenseId,
        date,
        category: expenseCategoryName(),
        method,
        description: `Salariu bazin ${month}`,
        amount: net,
      });
      recordRepository.save('expenses', expense);
      auditTrail.recordChange({
        action: 'adăugare',
        recordType: 'expenses',
        recordId: expense.id,
        before: null,
        after: expense,
      });
      auditTrail.recordChange({
        action: 'personal: plată salariu (corectată)',
        recordType: null,
        recordId: existing.id,
        before: null,
        after: { staffId, month, branchId },
      });
      personalRepository.kinds.save('salary_payments', {
        ...existing,
        amount: net,
        expenseId,
        paidAt: new Date().toISOString(),
      });
      return { paid: true, expenseId };
    }
    if (!(gross > 0)) return { paid: false };
    const undeducted = undeductedAdvances(month, staffId);
    const advancesTotal = undeducted.reduce((sum, advance) => sum + advance.amount, 0);
    const net = Math.max(0, Math.round((gross - advancesTotal) * 100) / 100);
    if (net <= 0) return { paid: false };
    const paymentId = personalRepository.salaryPaymentId(staffId, month, branchId);
    const expenseId = `EXP-bazin-${staffId}-${month}`;
    const expense = normalizeRecord('expenses', {
      id: expenseId,
      date,
      category: expenseCategoryName(),
      method,
      description: `Salariu bazin ${month}`,
      amount: net,
    });
    recordRepository.save('expenses', expense);
    auditTrail.recordChange({
      action: 'adăugare',
      recordType: 'expenses',
      recordId: expense.id,
      before: null,
      after: expense,
    });
    auditTrail.recordChange({
      action: 'personal: plată salariu',
      recordType: null,
      recordId: paymentId,
      before: null,
      after: { staffId, month, branchId },
    });
    personalRepository.kinds.transaction(() => {
      for (const advance of undeducted)
        personalRepository.kinds.save('advances', { ...advance, deductedAt: date, deductedBy: paymentId });
      personalRepository.kinds.save('salary_payments', {
        id: paymentId,
        staffId,
        month,
        branchId,
        mode: 'bazin',
        amount: net,
        advances: undeducted.map(advance => advance.id),
        expenseId,
        paidAt: new Date().toISOString(),
      });
    });
    return { paid: true, expenseId };
  }

  return { payCoach };
}
