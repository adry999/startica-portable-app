import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createKindRepository } from '#core/server/persistence/kind-repository.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import { createImmediateRevisionTransaction } from '#test-support/immediate-revision-transaction.mjs';
import { createRecordingAuditTrail } from '#test-support/recording-audit-trail.mjs';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { createPersonalRepository, createCoachPaymentWriter } from '#features/personal/index.server.mjs';
import { createPoolRepository, createPoolClosingService, POOL_SETTINGS_KEY } from '#features/pool/index.server.mjs';

const BRANCH_ID = 'branch-A';
const SETTINGS = {
  enabled: true,
  pricePerSession: 150,
  durationMin: 30,
  hoursFrom: '09:00',
  hoursTo: '11:30',
  seatsPerSlot: 6,
  chargeUnexcusedAbsence: true,
  coachPayMode: 'per_child',
  coachRate: 60,
};

/** @param {import('node:test').TestContext} t @param {{ today?: () => string }} [options] */
function harness(t, { today = () => '2026-09-30' } = {}) {
  const branchDb = new DatabaseSync(':memory:');
  applySchema(branchDb);
  t.after(() => branchDb.close());
  const recordRepository = createRecordRepository(branchDb);
  recordRepository.save('categories', normalizeRecord('categories', { id: 'CAT-salarii', name: 'Salarii' }));
  recordRepository.save('children', normalizeRecord('children', { id: 'C-1', name: 'Copil unu', status: 'Activ' }));
  const { run: runRevisionTransaction } = createImmediateRevisionTransaction(recordRepository);
  const auditTrail = createRecordingAuditTrail();

  const branchSettings = createSettingsRepository(branchDb);
  branchSettings.setSetting(POOL_SETTINGS_KEY, JSON.stringify(SETTINGS));

  const commonDb = new DatabaseSync(':memory:');
  t.after(() => commonDb.close());
  applySchema(commonDb);
  const commonSettings = createSettingsRepository(commonDb);
  const personalRepository = createPersonalRepository({
    kinds: createKindRepository(commonDb),
    readSetting: /** @type {(key: string) => string} */ (commonSettings.setting),
    writeSetting: commonSettings.setSetting,
  });
  const coachRoleId = personalRepository.roles().find(role => role.name === 'Antrenor bazin')?.id;
  personalRepository.saveStaff(
    { id: 'STF-1', name: 'Antrenor unu', roleId: coachRoleId, branchIds: [BRANCH_ID], since: '2026-01-01' },
    'create',
  );

  const coachPaymentWriter = createCoachPaymentWriter({
    personalRepository,
    branchId: BRANCH_ID,
    recordRepository,
    auditTrail,
  });
  const poolRepository = createPoolRepository(branchDb);
  const service = createPoolClosingService({
    poolRepository,
    recordRepository,
    runRevisionTransaction,
    auditTrail,
    readSetting: /** @type {(key: string) => string} */ (branchSettings.setting),
    listCoaches: () => personalRepository.staffForBranch(BRANCH_ID),
    payCoach: coachPaymentWriter.payCoach,
    today,
  });
  return { service, poolRepository, recordRepository, personalRepository };
}

/** @param {ReturnType<typeof harness>['poolRepository']} poolRepository @param {string[]} presentDates */
function seedBookingAndSessions(poolRepository, presentDates) {
  poolRepository.saveBooking({
    id: 'PB-1',
    childId: 'C-1',
    coachId: 'STF-1',
    weekday: 2,
    time: '09:00',
    startDate: '2026-09-01',
    endDate: null,
    archivedAt: null,
    updatedAt: '2026-09-01T00:00:00Z',
  });
  for (const date of presentDates)
    poolRepository.applySessionChanges([{ bookingId: 'PB-1', date, status: 'present' }], () => '2026-09-30T00:00:00Z');
}

test('închiderea lunii a doua oară nu dublează nici taxa copilului, nici cheltuiala antrenorului', t => {
  const { service, recordRepository, poolRepository } = harness(t);
  seedBookingAndSessions(poolRepository, ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29']);

  const first = service.closeMonth({
    month: '2026-09',
    method: 'cash',
    date: '2026-09-30',
    revision: 0,
    requestId: 'req-1',
  });
  assert.equal(first.charges, 1);
  assert.equal(first.coaches, 1);
  const charge = recordRepository.find('charges', 'CHG-bazin-C-1-2026-09');
  assert.equal(charge.amount, 750); // 5 ședințe × 150
  const expensesAfterFirst = recordRepository.readSnapshot().expenses.length;

  const second = service.closeMonth({
    month: '2026-09',
    method: 'cash',
    date: '2026-09-30',
    revision: 1,
    requestId: 'req-2',
  });
  // Recompută pe aceleași date — id-uri deterministe, deci suprascrie, nu dublează.
  assert.equal(recordRepository.find('charges', 'CHG-bazin-C-1-2026-09').amount, 750);
  assert.equal(recordRepository.readSnapshot().charges.length, 1);
  assert.equal(recordRepository.readSnapshot().expenses.length, expensesAfterFirst); // nicio cheltuială nouă a antrenorului
  assert.equal(second.coaches, 0); // deja plătit — payCoach nu mai scrie a doua oară
});

test('închiderea refuză o lună cu ședințe nemarcate', t => {
  const { service, poolRepository } = harness(t);
  seedBookingAndSessions(poolRepository, ['2026-09-01']); // 08, 15, 22, 29 rămân nemarcate

  assert.throws(
    () => service.closeMonth({ month: '2026-09', method: 'cash', date: '2026-09-30', revision: 0, requestId: 'req-1' }),
    /nemarcat/,
  );
});

test('avansul antrenorului se scade o singură dată și rămâne scăzut la reînchidere', t => {
  const { service, recordRepository, poolRepository, personalRepository } = harness(t);
  seedBookingAndSessions(poolRepository, ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29']);
  // Antrenorul primește un avans manual (ca la orice angajat) — scris direct în comun+cheltuieli,
  // fără să treacă prin ruta Personal (nu e nevoie de PIN pentru a pregăti fixtura testului).
  recordRepository.save(
    'expenses',
    normalizeRecord('expenses', { id: 'EXP-avans-1', date: '2026-09-10', category: 'Salarii', amount: 50 }),
  );
  personalRepository.kinds.save('advances', {
    id: 'ADV-1',
    staffId: 'STF-1',
    date: '2026-09-10',
    amount: 50,
    method: 'cash',
    month: '2026-09',
    expenseId: 'EXP-avans-1',
    deductedAt: null,
    deductedBy: null,
  });

  service.closeMonth({ month: '2026-09', method: 'cash', date: '2026-09-30', revision: 0, requestId: 'req-1' });
  // Antrenorul e singur pe slot: 5 prezențe × 60 = 300, minus avansul de 50 = 250.
  const paymentId = personalRepository.salaryPaymentId('STF-1', '2026-09', BRANCH_ID);
  const payment = personalRepository.kinds.find('salary_payments', paymentId);
  assert.equal(payment.amount, 250);
  const advance = personalRepository.kinds.find('advances', 'ADV-1');
  assert.equal(advance.deductedBy, paymentId);

  service.closeMonth({ month: '2026-09', method: 'cash', date: '2026-09-30', revision: 1, requestId: 'req-2' });
  // Reînchiderea nu mai scade avansul a doua oară (rămâne legat de aceeași plată).
  assert.equal(personalRepository.kinds.find('advances', 'ADV-1').deductedBy, paymentId);
});

test('A-4: reînchiderea după corectarea unei ședințe rescrie și plata antrenorului, nu doar taxa copilului', t => {
  const { service, recordRepository, poolRepository, personalRepository } = harness(t);
  seedBookingAndSessions(poolRepository, ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29']);

  const first = service.closeMonth({
    month: '2026-09',
    method: 'cash',
    date: '2026-09-30',
    revision: 0,
    requestId: 'req-1',
  });
  assert.equal(first.coaches, 1);
  assert.equal(recordRepository.find('charges', 'CHG-bazin-C-1-2026-09').amount, 750); // 5 × 150

  const paymentId = personalRepository.salaryPaymentId('STF-1', '2026-09', BRANCH_ID);
  const paymentAfterFirst = personalRepository.kinds.find('salary_payments', paymentId);
  assert.equal(paymentAfterFirst.amount, 300); // 5 prezențe × 60 (per_child, un singur copil)
  const firstExpenseId = paymentAfterFirst.expenseId;
  assert.equal(recordRepository.find('expenses', firstExpenseId).amount, 300);

  // Corecție: ședința din 29 septembrie a fost marcată greșit „Prezent” — de fapt copilul a fost
  // motivat. Taxa copilului trebuie să scadă, iar plata antrenorului nu mai are acea ședință.
  poolRepository.applySessionChanges(
    [{ bookingId: 'PB-1', date: '2026-09-29', status: 'excused' }],
    () => '2026-10-01T00:00:00Z',
  );

  const second = service.closeMonth({
    month: '2026-09',
    method: 'cash',
    date: '2026-10-01',
    revision: 1,
    requestId: 'req-2',
  });
  assert.equal(recordRepository.find('charges', 'CHG-bazin-C-1-2026-09').amount, 600); // 4 × 150
  // Înainte de fix, payCoach vedea `validPayment` deja plătit și ieșea fără să scrie nimic —
  // `coaches` rămânea 0 la reînchidere chiar dacă suma s-a schimbat. Acum se rescrie.
  assert.equal(second.coaches, 1);

  const paymentAfterSecond = personalRepository.kinds.find('salary_payments', paymentId);
  // Același id de plată — un eventual avans deja scăzut rămâne legat corect (nu se scade a doua oară).
  assert.equal(paymentAfterSecond.id, paymentId);
  assert.equal(paymentAfterSecond.amount, 240); // 4 prezențe × 60

  const oldExpense = recordRepository.find('expenses', firstExpenseId);
  assert.equal(oldExpense.archived, true); // cheltuiala veche (300 lei) arhivată, nu ștearsă

  const newExpense = recordRepository.find('expenses', paymentAfterSecond.expenseId);
  assert.notEqual(newExpense.id, firstExpenseId);
  assert.equal(newExpense.amount, 240);
  assert.ok(!newExpense.archived);

  // Nicio cheltuială vie duplicată pentru acest antrenor — doar cea nouă e nearhivată.
  const liveCoachExpenses = recordRepository
    .readSnapshot()
    .expenses.filter(expense => expense.id.startsWith('EXP-bazin-STF-1-2026-09') && !expense.archived);
  assert.equal(liveCoachExpenses.length, 1);

  // O a treia reînchidere fără nicio altă corecție e no-op — nu mai scrie o cheltuială nouă.
  const third = service.closeMonth({
    month: '2026-09',
    method: 'cash',
    date: '2026-10-01',
    revision: 2,
    requestId: 'req-3',
  });
  assert.equal(third.coaches, 0);
  assert.equal(
    recordRepository
      .readSnapshot()
      .expenses.filter(expense => expense.id.startsWith('EXP-bazin-STF-1-2026-09') && !expense.archived).length,
    1,
  );
});
