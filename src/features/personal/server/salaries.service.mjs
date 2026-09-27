import { randomUUID } from 'node:crypto';
import { fail } from '#core/server/errors/domain-error.mjs';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { normalizePersonalRecord } from '../domain/personal-schema.mjs';
import { salaryForMonth, salaryEntryFor } from '../domain/salary-computation.mjs';
import { summarizeTimesheetMonth, timesheetKey } from '../domain/timesheet-month.mjs';

const EXPENSE_CATEGORY = 'Salarii';

/** @typedef {import('../personal.types.d.mts').Staff} Staff */
/** @typedef {import('./personal.repository.mjs').PersonalRepository} PersonalRepository */

/**
 * Salariile, avansurile și plata lor (decizia 6–7 din plan). Cele două fișiere (filiala
 * activă și baza comună) nu pot împărți o tranzacție: `runRevisionTransaction` al filialei
 * rulează primul, iar în interiorul lui — după salvarea cheltuielii — se scriu și rândurile
 * din `comun`. O scriere ruptă (foarte rar) lasă „De plătit” pe ecran în loc să ascundă bani:
 * „plătit” = rândul `salary_payments` ȘI cheltuiala lui, nearhivată.
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
  today = () => new Date().toISOString().slice(0, 10),
}) {
  /** @param {Staff} staff @param {string} month @param {import('../personal.types.d.mts').PersonalSettings} settings */
  function rowForStaff(staff, month, settings) {
    const salary = salaryEntryFor(personalRepository.salariesForStaff(staff.id), staff.id, month);
    if (!salary) return null;
    const rows = new Map(
      personalRepository.timesheetForMonth(month, [staff.id]).map(row => [timesheetKey(staff.id, row.date), row]),
    );
    const timesheetRow = summarizeTimesheetMonth({ staff, month, rows, todayStr: today(), upTo: 'month' });
    const coachPay =
      salary.mode === 'bazin'
        ? /** @type {{ amount: number, rate: number, sessionsHeld: number, childrenPresent: number, mode: 'per_child' | 'per_session' } | null} */ (
            readCoachPayForMonth(staff.id, month)
          )
        : null;
    const { gross, base, deductible } = salaryForMonth({ salary, timesheetRow, settings, coachPay });
    const undeducted = personalRepository.advancesForMonth(month, [staff.id]).filter(advance => !advance.deductedAt);
    const advancesTotal = undeducted.reduce((sum, advance) => sum + advance.amount, 0);
    const net = gross === null ? null : Math.max(0, Math.round((gross - advancesTotal) * 100) / 100);
    const payment = personalRepository.kinds.find(
      'salary_payments',
      personalRepository.salaryPaymentId(staff.id, month, branchId),
    );
    const expense = payment ? recordRepository.find('expenses', payment.expenseId) : null;
    const paid =
      payment && expense && !expense.archived ? { branchId: payment.branchId, paidAt: payment.paidAt } : null;
    return { staff, mode: salary.mode, base, gross, advances: advancesTotal, net, paid, deductible };
  }

  /** @param {string} month @returns {{ rows: ReturnType<typeof rowForStaff>[], totals: { gross: number, advances: number, net: number, paid: number } }} */
  function listMonth(month) {
    const settings = personalRepository.readSettings();
    const rows = personalRepository
      .staffForBranch(branchId)
      .filter(staff => !staff.archivedAt)
      .map(staff => rowForStaff(staff, month, settings))
      .filter(row => row !== null);
    const totals = rows.reduce(
      (totals, row) => ({
        gross: totals.gross + (row.gross || 0),
        advances: totals.advances + row.advances,
        net: totals.net + (row.net || 0),
        paid: totals.paid + (row.paid ? row.net || 0 : 0),
      }),
      { gross: 0, advances: 0, net: 0, paid: 0 },
    );
    return { rows, totals };
  }

  /** @param {{ staffId: string, date: string, amount: number, method: string, month: string, revision: number, requestId: string }} input */
  function giveAdvance({ staffId, date, amount, method, month, revision, requestId }) {
    const staff = personalRepository.kinds.find('staff', staffId);
    if (!staff) fail('Angajatul nu mai există.', 409);
    const advanceId = `ADV-${randomUUID()}`;
    const expenseId = `EXP-avans-${advanceId}`;
    const envelope = runRevisionTransaction(
      { revision, requestId },
      { action: 'avans salariu', backupBefore: false },
      () => {
        const expense = normalizeRecord('expenses', {
          id: expenseId,
          date,
          category: EXPENSE_CATEGORY,
          method,
          description: `Avans ${month} · ${staff.name}`,
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
          month,
          expenseId,
          deductedAt: null,
          deductedBy: null,
        });
        personalRepository.kinds.save('advances', advance);
      },
    );
    return { ...envelope, advance: personalRepository.kinds.find('advances', advanceId) };
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
   * `salary_payments` — a doua plată e no-op (`skipped`), la fel un `bazin` selectat (400).
   * @param {{ staffIds: string[], month: string, method: string, date: string, revision: number, requestId: string }} input
   */
  function pay({ staffIds, month, method, date, revision, requestId }) {
    if (!Array.isArray(staffIds) || staffIds.length === 0) fail('Nu a fost selectat niciun angajat.');
    const settings = personalRepository.readSettings();
    const staffList = staffIds.map(id => {
      const staff = personalRepository.kinds.find('staff', id);
      if (!staff) fail('Angajat inexistent.', 409);
      return staff;
    });
    const salaries = personalRepository.kinds.list('salaries');
    for (const staff of staffList) {
      const salary = salaryEntryFor(salaries, staff.id, month);
      if (salary?.mode === 'bazin') fail(`${staff.name}: salariul se plătește din Bazin.`);
    }

    const paid = [];
    const skipped = [];
    const envelope = runRevisionTransaction(
      { revision, requestId },
      { action: 'plată salarii', backupBefore: false },
      () => {
        for (const staff of staffList) {
          const paymentId = personalRepository.salaryPaymentId(staff.id, month, branchId);
          if (personalRepository.kinds.find('salary_payments', paymentId)) {
            skipped.push(staff.id);
            continue;
          }
          const row = rowForStaff(staff, month, settings);
          if (!row || row.net === null) {
            skipped.push(staff.id);
            continue;
          }
          const expenseId = `EXP-salariu-${staff.id}-${month}`;
          const expense = normalizeRecord('expenses', {
            id: expenseId,
            date,
            category: EXPENSE_CATEGORY,
            method,
            description: `Salariu ${month} · ${staff.name}`,
            amount: row.net,
          });
          recordRepository.save('expenses', expense);
          auditTrail.recordChange({
            action: 'adăugare',
            recordType: 'expenses',
            recordId: expense.id,
            before: null,
            after: expense,
          });
          const undeductedIds = personalRepository
            .advancesForMonth(month, [staff.id])
            .filter(advance => !advance.deductedAt)
            .map(advance => advance.id);
          for (const advanceId of undeductedIds) {
            const advance = personalRepository.kinds.find('advances', advanceId);
            personalRepository.kinds.save('advances', { ...advance, deductedAt: date, deductedBy: paymentId });
          }
          const payment = normalizePersonalRecord('salary_payments', {
            id: paymentId,
            staffId: staff.id,
            month,
            branchId,
            mode: row.mode,
            amount: row.net,
            advances: undeductedIds,
            expenseId,
            paidAt: new Date().toISOString(),
          });
          personalRepository.kinds.save('salary_payments', payment);
          auditTrail.recordChange({
            action: 'personal: plată salariu',
            recordType: null,
            recordId: paymentId,
            before: null,
            after: payment,
          });
          paid.push(staff.id);
        }
      },
    );
    return { ...envelope, paid, skipped };
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
