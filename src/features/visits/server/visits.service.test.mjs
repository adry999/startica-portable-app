import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryRecordRepository } from '#test-support/in-memory-record-repository.mjs';
import { createRecordingAuditTrail } from '#test-support/recording-audit-trail.mjs';
import { createImmediateRevisionTransaction } from '#test-support/immediate-revision-transaction.mjs';
import { createVisitsRecords, newChildInput, scheduledVisit } from '../test-support/visit-record-fixtures.mjs';
import { createVisitsService } from './visits.service.mjs';

function createHarness(initialRecords = createVisitsRecords()) {
  const recordRepository = createInMemoryRecordRepository(initialRecords);
  const auditTrail = createRecordingAuditTrail();
  const transaction = createImmediateRevisionTransaction(recordRepository);
  const service = createVisitsService({ recordRepository, auditTrail, runRevisionTransaction: transaction.run });
  return { recordRepository, service, auditTrail, transaction };
}

const enrolRequest = (visitId, child) => ({ visitId, child, revision: 0, requestId: 'inscriere-0001' });

test('înscrie copilul: creează fișa, mută notele medicale și marchează vizita Înscris', () => {
  const { service, recordRepository, auditTrail } = createHarness({
    ...createVisitsRecords(),
    visits: [scheduledVisit({ status: 'Efectuată' })],
  });

  const result = service.enrolChild(
    { visitId: 'VIZ-1', child: newChildInput() },
    { revision: 0, requestId: 'inscriere-0001' },
  );

  assert.equal(result.childId, 'CH-NOU');
  const child = recordRepository.find('children', 'CH-NOU');
  assert.ok(child, 'Fișa copilului a fost salvată.');
  const visit = recordRepository.find('visits', 'VIZ-1');
  assert.ok(visit, 'Vizita a rămas în bază.');
  assert.equal(visit.status, 'Înscris');
  assert.equal(visit.childId, 'CH-NOU');
  assert.equal(visit.healthNotes, '');
  const lastHistoryEntry = visit.history.at(-1);
  assert.ok(lastHistoryEntry);
  assert.equal(lastHistoryEntry.status, 'Înscris');
  assert.deepEqual(
    auditTrail.changes.map(change => [change.action, change.recordType, change.recordId]),
    [
      ['adăugare', 'children', 'CH-NOU'],
      ['modificare', 'visits', 'VIZ-1'],
    ],
  );
});

test('refuză înscrierea când vizita nu mai există', () => {
  const { service } = createHarness();

  assert.throws(() => service.enrolChild({ visitId: 'VIZ-LIPSA', child: newChildInput() }, enrolRequest('VIZ-LIPSA')), {
    status: 409,
    message: /nu mai există/,
  });
});

test('refuză înscrierea unei vizite deja înscrise', () => {
  /** @type {import('#shared/contracts/record-types.mjs').Visit} */
  const enrolled = { ...scheduledVisit(), status: 'Înscris', childId: 'CH-VECHI' };
  const { service } = createHarness({ ...createVisitsRecords(), visits: [enrolled] });

  assert.throws(() => service.enrolChild({ visitId: 'VIZ-1', child: newChildInput() }, enrolRequest('VIZ-1')), {
    status: 409,
    message: /deja înscris/,
  });
});

test('refuză înscrierea unei vizite arhivate', () => {
  const archived = { ...scheduledVisit(), archived: true, archivedAt: '2026-01-01T00:00:00.000Z' };
  const { service } = createHarness({ ...createVisitsRecords(), visits: [archived] });

  assert.throws(() => service.enrolChild({ visitId: 'VIZ-1', child: newChildInput() }, enrolRequest('VIZ-1')), {
    status: 400,
    message: /Reactivează/,
  });
});

test('refuză înscrierea unei vizite care nu e Efectuată', () => {
  const { service } = createHarness({ ...createVisitsRecords(), visits: [scheduledVisit({ status: 'Programată' })] });

  assert.throws(() => service.enrolChild({ visitId: 'VIZ-1', child: newChildInput() }, enrolRequest('VIZ-1')), {
    status: 400,
    message: /trebuie marcată Efectuată/,
  });
});

test('refuză un id de copil deja folosit', () => {
  const records = createVisitsRecords();
  records.visits = [scheduledVisit({ status: 'Efectuată' })];
  records.children.push({ ...newChildInput(), id: 'CH-NOU' });
  const { service } = createHarness(records);

  assert.throws(() => service.enrolChild({ visitId: 'VIZ-1', child: newChildInput() }, enrolRequest('VIZ-1')), {
    status: 409,
    message: /ID deja folosit/,
  });
});

test('refuză o grupă inexistentă pentru copilul nou', () => {
  const { service } = createHarness({
    ...createVisitsRecords(),
    visits: [scheduledVisit({ status: 'Efectuată' })],
  });

  assert.throws(
    () =>
      service.enrolChild({ visitId: 'VIZ-1', child: newChildInput({ groupId: 'GRP-LIPSA' }) }, enrolRequest('VIZ-1')),
    { message: /Grupa asociată nu există/ },
  );
});

test('expirarea nu scrie nimic când nu există note medicale vechi', () => {
  const { service, transaction, auditTrail, recordRepository } = createHarness();
  const revisionBefore = recordRepository.currentRevision();

  const result = service.expireHealthNotes('2026-09-11');

  assert.deepEqual(result, { expired: 0 });
  assert.equal(transaction.calls.length, 0);
  assert.equal(auditTrail.changes.length, 0);
  assert.equal(recordRepository.currentRevision(), revisionBefore);
});

test('expirarea golește notele medicale vechi de vizite și copii arhivați și consemnează în istoric', () => {
  const oldVisit = scheduledVisit({ id: 'VIZ-VECHI', statusChangedAt: '2025-01-01T00:00:00.000Z' });
  const recentVisit = scheduledVisit({ id: 'VIZ-RECENT', statusChangedAt: '2026-09-01T00:00:00.000Z' });
  const oldChild = {
    ...newChildInput({ id: 'CH-VECHI', healthNotes: 'Astm' }),
    archived: true,
    archivedAt: '2025-01-01T00:00:00.000Z',
  };
  const records = { ...createVisitsRecords(), visits: [oldVisit, recentVisit], children: [oldChild] };
  const { service, transaction, auditTrail, recordRepository } = createHarness(records);

  const result = service.expireHealthNotes('2026-09-11');

  assert.equal(result.expired, 2);
  const oldVisitAfter = recordRepository.find('visits', 'VIZ-VECHI');
  const recentVisitAfter = recordRepository.find('visits', 'VIZ-RECENT');
  const oldChildAfter = recordRepository.find('children', 'CH-VECHI');
  assert.ok(oldVisitAfter && recentVisitAfter && oldChildAfter, 'Vizitele și copilul au rămas în bază.');
  assert.equal(oldVisitAfter.healthNotes, '');
  assert.equal(recentVisitAfter.healthNotes, recentVisit.healthNotes);
  assert.equal(oldChildAfter.healthNotes, '');
  assert.equal(transaction.calls.length, 1);
  assert.equal(transaction.calls[0].options.action, 'expirare-date-medicale');
  assert.deepEqual(
    auditTrail.changes.map(change => change.action),
    ['expirare date medicale', 'expirare date medicale'],
  );
});
