import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createKindRepository } from '#core/server/persistence/kind-repository.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import { createImmediateRevisionTransaction } from '#test-support/immediate-revision-transaction.mjs';
import { createRecordingAuditTrail } from '#test-support/recording-audit-trail.mjs';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { createPersonalRepository } from './personal.repository.mjs';
import { createSalariesService } from './salaries.service.mjs';

const BRANCH_ID = 'branch-A';
const OTHER_BRANCH_ID = 'branch-B';
// Lună închisă implicit pentru teste care nu vizează M4 — orice test M4 își dă propriul `today`.
const DEFAULT_TODAY = () => '2026-10-05';

/** @param {import('node:test').TestContext} t @param {{ today?: () => string, seedSalaryCategory?: boolean }} [options] */
function createServiceHarness(t, { today = DEFAULT_TODAY, seedSalaryCategory = true } = {}) {
  const branchDb = new DatabaseSync(':memory:');
  applySchema(branchDb);
  t.after(() => branchDb.close());
  const recordRepository = createRecordRepository(branchDb);
  // Producția seamănă categoria „Salarii” la id fix CAT-salarii (expense-category-seeding.mjs);
  // testele o repetă aici, ca m8 (rezolvare după id, nu literal) să aibă ce rezolva.
  if (seedSalaryCategory)
    recordRepository.save('categories', normalizeRecord('categories', { id: 'CAT-salarii', name: 'Salarii' }));
  const { run: runRevisionTransaction } = createImmediateRevisionTransaction(recordRepository);
  const auditTrail = createRecordingAuditTrail();

  const commonDb = new DatabaseSync(':memory:');
  applySchema(commonDb);
  t.after(() => commonDb.close());
  const settings = createSettingsRepository(commonDb);
  const personalRepository = createPersonalRepository({
    kinds: createKindRepository(commonDb),
    readSetting: /** @type {(key: string) => string} */ (settings.setting),
    writeSetting: settings.setSetting,
  });

  const service = createSalariesService({
    personalRepository,
    branchId: BRANCH_ID,
    recordRepository,
    runRevisionTransaction,
    auditTrail,
    today,
  });
  return { service, personalRepository, recordRepository, auditTrail };
}

/** @param {ReturnType<typeof createServiceHarness>['personalRepository']} personalRepository */
function seedStaffWithFixSalary(personalRepository, { staffId = 'STF-1', amount = 4400, branchId = BRANCH_ID } = {}) {
  personalRepository.saveStaff(
    {
      id: staffId,
      name: 'Ana Popescu',
      roleId: personalRepository.roles()[0].id,
      branchIds: [branchId],
      since: '2026-01-01',
    },
    'create',
  );
  personalRepository.saveSalary({ id: `SAL-${staffId}`, staffId, mode: 'fix', amount, validFrom: '2026-01' });
  return staffId;
}

test('avansul lunii se scade la plată o singură dată; a doua plată e ignorată și avansul rămâne scăzut', t => {
  const { service, personalRepository } = createServiceHarness(t);
  const staffId = seedStaffWithFixSalary(personalRepository);

  const advanceResult = service.giveAdvance({
    staffId,
    date: '2026-09-05',
    amount: 500,
    method: 'cash',
    month: '2026-09',
    revision: 0,
    requestId: randomUUID(),
  });

  const firstPay = service.pay({
    staffIds: [staffId],
    month: '2026-09',
    method: 'cash',
    date: '2026-09-30',
    revision: advanceResult.revision,
    requestId: randomUUID(),
  });
  assert.deepEqual(firstPay.paid, [staffId]);
  const advanceAfterFirstPay = personalRepository.kinds.find('advances', advanceResult.advance.id);
  assert.ok(advanceAfterFirstPay.deductedAt);
  const paymentId = personalRepository.salaryPaymentId(staffId, '2026-09', BRANCH_ID);
  const netAfterFirstPay = personalRepository.kinds.find('salary_payments', paymentId).amount;
  assert.equal(netAfterFirstPay, 4400 - 500);

  const secondPay = service.pay({
    staffIds: [staffId],
    month: '2026-09',
    method: 'cash',
    date: '2026-10-01',
    revision: firstPay.revision,
    requestId: randomUUID(),
  });
  assert.deepEqual(secondPay.paid, []);
  assert.deepEqual(secondPay.skipped, [staffId]);
  // a doua plată nu dublează scăderea avansului: câmpul deductedAt rămâne cel din prima plată.
  assert.equal(personalRepository.kinds.find('advances', advanceResult.advance.id).deductedBy, paymentId);
});

test('plata creează o cheltuială Salarii cu id determinist în filiala activă și o marchează în comun', t => {
  const { service, personalRepository, recordRepository } = createServiceHarness(t);
  const staffId = seedStaffWithFixSalary(personalRepository);

  const result = service.pay({
    staffIds: [staffId],
    month: '2026-09',
    method: 'card',
    date: '2026-09-30',
    revision: 0,
    requestId: randomUUID(),
  });
  assert.deepEqual(result.paid, [staffId]);

  const expenseId = `EXP-salariu-${staffId}-2026-09`;
  const expense = recordRepository.find('expenses', expenseId);
  assert.ok(expense);
  assert.equal(expense.category, 'Salarii');
  assert.equal(expense.amount, 4400);

  const payment = personalRepository.kinds.find(
    'salary_payments',
    personalRepository.salaryPaymentId(staffId, '2026-09', BRANCH_ID),
  );
  assert.equal(payment.expenseId, expenseId);
  assert.equal(payment.branchId, BRANCH_ID);
});

test('o cursă bazin selectată la plată e refuzată — se plătește din Bazin', t => {
  const { service, personalRepository } = createServiceHarness(t);
  const staffId = seedStaffWithFixSalary(personalRepository, { staffId: 'STF-coach' });
  // validFrom ulterior celui „fix” (nu doar id alfabetic mai mare) — salaryEntryFor ia
  // ultima intrare cronologic, indiferent de ordinea de scriere.
  personalRepository.saveSalary({ id: 'SAL-2', staffId, mode: 'bazin', amount: 0, validFrom: '2026-02' });

  assert.throws(
    () =>
      service.pay({
        staffIds: [staffId],
        month: '2026-09',
        method: 'cash',
        date: '2026-09-30',
        revision: 0,
        requestId: randomUUID(),
      }),
    /Bazin/,
  );
});

test('listMonth arată salariul net și starea plătit fără sume expuse mai mult decât cere ecranul', t => {
  const { service, personalRepository } = createServiceHarness(t);
  const staffId = seedStaffWithFixSalary(personalRepository);

  let listing = service.listMonth('2026-09');
  assert.equal(listing.rows.length, 1);
  assert.equal(listing.rows[0]?.paid, null);

  service.pay({
    staffIds: [staffId],
    month: '2026-09',
    method: 'cash',
    date: '2026-09-30',
    revision: 0,
    requestId: randomUUID(),
  });
  listing = service.listMonth('2026-09');
  assert.ok(listing.rows[0]?.paid);
  assert.equal(listing.totals.paid, 4400);
});

// --- C1 + M2: validarea întregului lot înainte de tranzacție -----------------------------------

test('un lot cu un angajat cu avansuri ce acoperă salariul refuză tot lotul, fără să scrie nimic pentru ceilalți (C1 + M2)', t => {
  const { service, personalRepository, recordRepository } = createServiceHarness(t);
  const staffOk = seedStaffWithFixSalary(personalRepository, { staffId: 'STF-1', amount: 4400 });
  const staffZero = seedStaffWithFixSalary(personalRepository, { staffId: 'STF-2', amount: 3000 });
  const advanceResult = service.giveAdvance({
    staffId: staffZero,
    date: '2026-09-05',
    amount: 3000,
    method: 'cash',
    month: '2026-09',
    revision: 0,
    requestId: randomUUID(),
  });

  assert.throws(
    () =>
      service.pay({
        staffIds: [staffOk, staffZero],
        month: '2026-09',
        method: 'cash',
        date: '2026-09-30',
        revision: advanceResult.revision,
        requestId: randomUUID(),
      }),
    /avansurile acoperă salariul/,
  );

  // C1: niciun rând orfan — nici pentru angajatul cu problema, nici pentru celălalt din lot.
  assert.equal(recordRepository.find('expenses', `EXP-salariu-${staffOk}-2026-09`), undefined);
  assert.equal(recordRepository.find('expenses', `EXP-salariu-${staffZero}-2026-09`), undefined);
  assert.equal(
    personalRepository.kinds.find('salary_payments', personalRepository.salaryPaymentId(staffOk, '2026-09', BRANCH_ID)),
    undefined,
  );
  assert.equal(
    personalRepository.kinds.find(
      'salary_payments',
      personalRepository.salaryPaymentId(staffZero, '2026-09', BRANCH_ID),
    ),
    undefined,
  );
  // E-2 (audit Comun): lotul e validat integral înainte de a marca vreun avans ca scăzut —
  // avansul lui staffZero rămâne nescăzut, nu doar cheltuiala/plata lipsesc.
  assert.equal(personalRepository.kinds.find('advances', advanceResult.advance.id).deductedBy, null);

  // Angajatul valid rămâne plătibil normal, singur, după ce lotul e corectat.
  const retry = service.pay({
    staffIds: [staffOk],
    month: '2026-09',
    method: 'cash',
    date: '2026-09-30',
    revision: advanceResult.revision,
    requestId: randomUUID(),
  });
  assert.deepEqual(retry.paid, [staffOk]);
});

test('un angajat cu avansuri ce acoperă tot salariul e refuzat cu numele lui în mesaj, nu cu eroarea generică de sumă (M2)', t => {
  const { service, personalRepository } = createServiceHarness(t);
  const staffId = seedStaffWithFixSalary(personalRepository, { staffId: 'STF-1', amount: 3000 });
  const advanceResult = service.giveAdvance({
    staffId,
    date: '2026-09-05',
    amount: 3000,
    method: 'cash',
    month: '2026-09',
    revision: 0,
    requestId: randomUUID(),
  });

  assert.throws(
    () =>
      service.pay({
        staffIds: [staffId],
        month: '2026-09',
        method: 'cash',
        date: '2026-09-30',
        revision: advanceResult.revision,
        requestId: randomUUID(),
      }),
    /Ana Popescu.*avansurile acoperă salariul/,
  );
});

// --- M1: rândul plătit citește chitanța plății, nu recalculul curent al avansurilor ------------

test('rândul plătit arată avansul și netul din chitanța plății, nu recalculul curent (M1)', t => {
  const { service, personalRepository } = createServiceHarness(t);
  const staffId = seedStaffWithFixSalary(personalRepository);
  const advanceResult = service.giveAdvance({
    staffId,
    date: '2026-09-05',
    amount: 1000,
    method: 'cash',
    month: '2026-09',
    revision: 0,
    requestId: randomUUID(),
  });

  service.pay({
    staffIds: [staffId],
    month: '2026-09',
    method: 'cash',
    date: '2026-09-30',
    revision: advanceResult.revision,
    requestId: randomUUID(),
  });

  const listing = service.listMonth('2026-09');
  assert.equal(listing.rows[0]?.advances, 1000);
  assert.equal(listing.rows[0]?.net, 3400);
  assert.equal(listing.totals.paid, 3400);
});

// --- M3: pro-rata pentru intrare în cursul lunii, văzut prin listMonth --------------------------

test('salariul fix e pro-rata pentru un angajat intrat în cursul lunii, prin listMonth (M3)', t => {
  const { service, personalRepository } = createServiceHarness(t);
  personalRepository.saveStaff(
    {
      id: 'STF-1',
      name: 'Ana Popescu',
      roleId: personalRepository.roles()[0].id,
      branchIds: [BRANCH_ID],
      since: '2026-09-15',
    },
    'create',
  );
  personalRepository.saveSalary({ id: 'SAL-1', staffId: 'STF-1', mode: 'fix', amount: 4400, validFrom: '2026-01' });

  const listing = service.listMonth('2026-09');
  assert.equal(listing.rows.length, 1);
  const row = listing.rows[0];
  assert.ok(row && row.gross !== null && row.gross < 4400);
  assert.match(row?.base ?? '', /din 22 zile lucrătoare/);
});

// --- M4: o lună necheiată nu se poate plăti; listMonth o arată ca estimare ---------------------

test('pay() refuză o lună care nu s-a încheiat (M4)', t => {
  const { service, personalRepository } = createServiceHarness(t, { today: () => '2026-09-15' });
  const staffId = seedStaffWithFixSalary(personalRepository);
  assert.throws(
    () =>
      service.pay({
        staffIds: [staffId],
        month: '2026-09',
        method: 'cash',
        date: '2026-09-15',
        revision: 0,
        requestId: randomUUID(),
      }),
    /Luna nu s-a încheiat/,
  );
});

test('listMonth pentru luna curentă marchează estimarea și nu ia zilele viitoare ca lucrate (M4)', t => {
  const { service, personalRepository } = createServiceHarness(t, { today: () => '2026-09-10' });
  seedStaffWithFixSalary(personalRepository);
  const listing = service.listMonth('2026-09');
  assert.equal(listing.estimated, true);
  const row = listing.rows[0];
  assert.equal(row?.estimated, true);
  assert.ok(row && row.gross !== null && row.gross < 4400);
});

test('listMonth pentru o lună închisă nu e marcată estimare', t => {
  const { service, personalRepository } = createServiceHarness(t, { today: () => '2026-10-05' });
  seedStaffWithFixSalary(personalRepository);
  const listing = service.listMonth('2026-09');
  assert.equal(listing.estimated, false);
  assert.equal(listing.rows[0]?.estimated, false);
});

// --- M5: filiala activă filtrează plata și avansul ----------------------------------------------

test('pay() refuză un angajat care nu lucrează la filiala activă (M5)', t => {
  const { service, personalRepository } = createServiceHarness(t);
  seedStaffWithFixSalary(personalRepository, { staffId: 'STF-other', branchId: OTHER_BRANCH_ID });

  assert.throws(
    () =>
      service.pay({
        staffIds: ['STF-other'],
        month: '2026-09',
        method: 'cash',
        date: '2026-09-30',
        revision: 0,
        requestId: randomUUID(),
      }),
    /nu lucrează la filiala activă/,
  );
});

test('giveAdvance refuză un angajat care nu lucrează la filiala activă (M5)', t => {
  const { service, personalRepository } = createServiceHarness(t);
  seedStaffWithFixSalary(personalRepository, { staffId: 'STF-other', branchId: OTHER_BRANCH_ID });

  assert.throws(
    () =>
      service.giveAdvance({
        staffId: 'STF-other',
        date: '2026-09-05',
        amount: 100,
        method: 'cash',
        month: '2026-09',
        revision: 0,
        requestId: randomUUID(),
      }),
    /nu lucrează la filiala activă/,
  );
});

// --- M11: avans dat pentru o lună deja plătită se mută pe luna următoare -------------------------

test('un avans dat pentru o lună deja plătită se scade la plata lunii următoare, nu se pierde (M11)', t => {
  const { service, personalRepository } = createServiceHarness(t, { today: () => '2026-11-05' });
  const staffId = seedStaffWithFixSalary(personalRepository);

  const septemberPay = service.pay({
    staffIds: [staffId],
    month: '2026-09',
    method: 'cash',
    date: '2026-09-30',
    revision: 0,
    requestId: randomUUID(),
  });
  assert.deepEqual(septemberPay.paid, [staffId]);

  const advanceResult = service.giveAdvance({
    staffId,
    date: '2026-10-02',
    amount: 500,
    method: 'cash',
    month: '2026-09',
    revision: septemberPay.revision,
    requestId: randomUUID(),
  });
  assert.equal(advanceResult.movedToNextMonth, true);
  assert.equal(advanceResult.advance.month, '2026-10');

  // rândul lunii septembrie, deja plătit, rămâne neschimbat.
  const septemberListing = service.listMonth('2026-09');
  assert.equal(septemberListing.rows[0]?.net, 4400);

  const octoberPay = service.pay({
    staffIds: [staffId],
    month: '2026-10',
    method: 'cash',
    date: '2026-10-31',
    revision: advanceResult.revision,
    requestId: randomUUID(),
  });
  assert.deepEqual(octoberPay.paid, [staffId]);
  const octoberPayment = personalRepository.kinds.find(
    'salary_payments',
    personalRepository.salaryPaymentId(staffId, '2026-10', BRANCH_ID),
  );
  assert.equal(octoberPayment.amount, 4400 - 500);
});

// --- m8: numele categoriei se rezolvă după id, cu cădere pe General -----------------------------

test('cheltuiala de salariu cade pe General dacă categoria „Salarii” a fost redenumită sau ștearsă (m8)', t => {
  const { service, personalRepository, recordRepository } = createServiceHarness(t, { seedSalaryCategory: false });
  const staffId = seedStaffWithFixSalary(personalRepository);

  const result = service.pay({
    staffIds: [staffId],
    month: '2026-09',
    method: 'cash',
    date: '2026-09-30',
    revision: 0,
    requestId: randomUUID(),
  });
  assert.deepEqual(result.paid, [staffId]);
  const expense = recordRepository.find('expenses', `EXP-salariu-${staffId}-2026-09`);
  assert.equal(expense.category, 'General');
});

// --- 24-personal:37, m11: cheltuiala și avansul nu poartă numele angajatului în Cheltuieli/Istoric -

test('cheltuiala de salariu și avansul nu poartă numele angajatului, iar Istoricul plății nu conține suma (24-personal:37)', t => {
  const { service, personalRepository, recordRepository, auditTrail } = createServiceHarness(t);
  const staffId = seedStaffWithFixSalary(personalRepository);

  const advanceResult = service.giveAdvance({
    staffId,
    date: '2026-09-05',
    amount: 1000,
    method: 'cash',
    month: '2026-09',
    revision: 0,
    requestId: randomUUID(),
  });
  const advanceExpense = recordRepository.find('expenses', advanceResult.advance.expenseId);
  assert.equal(advanceExpense.description, 'Avans 2026-09');
  assert.ok(!advanceExpense.description.includes('Ana Popescu'));

  service.pay({
    staffIds: [staffId],
    month: '2026-09',
    method: 'cash',
    date: '2026-09-30',
    revision: advanceResult.revision,
    requestId: randomUUID(),
  });
  const salaryExpense = recordRepository.find('expenses', `EXP-salariu-${staffId}-2026-09`);
  assert.equal(salaryExpense.description, 'Salariu 2026-09');
  assert.ok(!salaryExpense.description.includes('Ana Popescu'));

  const paymentAudit = auditTrail.changes.find(change => change.action === 'personal: plată salariu');
  assert.ok(paymentAudit);
  assert.equal(/** @type {{ amount?: number }} */ (paymentAudit?.after)?.amount, undefined);
});
