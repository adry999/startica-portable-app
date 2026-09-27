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
import { createPersonalRepository } from './personal.repository.mjs';
import { createSalariesService } from './salaries.service.mjs';

const BRANCH_ID = 'branch-A';

function createServiceHarness(t) {
  const branchDb = new DatabaseSync(':memory:');
  applySchema(branchDb);
  t.after(() => branchDb.close());
  const recordRepository = createRecordRepository(branchDb);
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
  });
  return { service, personalRepository, recordRepository, auditTrail };
}

/** @param {ReturnType<typeof createServiceHarness>['personalRepository']} personalRepository */
function seedStaffWithFixSalary(personalRepository, { staffId = 'STF-1', amount = 4400 } = {}) {
  personalRepository.saveStaff(
    {
      id: staffId,
      name: 'Ana Popescu',
      roleId: personalRepository.roles()[0].id,
      branchIds: [BRANCH_ID],
      since: '2026-01-01',
    },
    'create',
  );
  personalRepository.saveSalary({ id: 'SAL-1', staffId, mode: 'fix', amount, validFrom: '2026-01' });
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
  personalRepository.saveSalary({ id: 'SAL-2', staffId, mode: 'bazin', amount: 0, validFrom: '2026-01' });

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
