import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createSyncStateRepository } from './sync-state.repository.mjs';
import { createRecordingAuditTrail } from '#test-support/recording-audit-trail.mjs';
import { createChangeApplier, createSyncAttendanceWriter, SyncApplyError } from './change-applier.mjs';

function createHarness() {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  const rawRecordRepository = createRecordRepository(database);
  const attendanceRepository = createSyncAttendanceWriter(database);
  const syncState = createSyncStateRepository(database);
  const auditTrail = createRecordingAuditTrail();
  const applier = createChangeApplier({ rawRecordRepository, attendanceRepository, syncState, auditTrail });
  return { database, rawRecordRepository, attendanceRepository, syncState, auditTrail, applier };
}

const DEVICE = { id: 'dev-b', name: 'Calculator B' };

test('apply scrie o fișă primită de pe server prin depozitul brut și normalizeRecord', () => {
  const { rawRecordRepository, applier } = createHarness();

  applier.apply({
    kind: 'children',
    recordId: 'CHILD-1',
    payload: { id: 'CHILD-1', name: 'Ana', unknownField: 'ignorat' },
    revision: 3,
    changedAt: '2026-09-27T10:00:00.000Z',
    device: DEVICE,
  });

  const stored = rawRecordRepository.find('children', 'CHILD-1');
  assert.equal(stored.name, 'Ana');
  assert.equal(stored.unknownField, undefined);
});

test('apply cu payload null șterge înregistrarea', () => {
  const { rawRecordRepository, applier } = createHarness();
  rawRecordRepository.save('children', { id: 'CHILD-1', name: 'Ana' });

  applier.apply({
    kind: 'children',
    recordId: 'CHILD-1',
    payload: null,
    revision: 2,
    changedAt: '2026-09-27T10:00:00.000Z',
    device: DEVICE,
  });

  assert.equal(rawRecordRepository.find('children', 'CHILD-1'), undefined);
});

test('apply scrie sync_state cu revizia, ora și dispozitivul de pe server', () => {
  const { syncState, applier } = createHarness();

  applier.apply({
    kind: 'children',
    recordId: 'CHILD-1',
    payload: { id: 'CHILD-1', name: 'Ana' },
    revision: 5,
    changedAt: '2026-09-27T10:00:00.000Z',
    device: DEVICE,
  });

  assert.deepEqual(syncState.get('children', 'CHILD-1'), {
    kind: 'children',
    id: 'CHILD-1',
    serverRevision: 5,
    updatedAt: '2026-09-27T10:00:00.000Z',
    updatedByDevice: 'dev-b',
    updatedByName: 'Calculator B',
  });
});

test('apply consemnează o intrare în istoric cu numele calculatorului', () => {
  const { auditTrail, applier } = createHarness();

  applier.apply({
    kind: 'children',
    recordId: 'CHILD-1',
    payload: { id: 'CHILD-1', name: 'Ana' },
    revision: 1,
    changedAt: '2026-09-27T10:00:00.000Z',
    device: DEVICE,
  });

  assert.equal(auditTrail.changes.length, 1);
  assert.equal(auditTrail.changes[0].action, 'sincronizare de pe Calculator B');
  assert.equal(auditTrail.changes[0].recordId, 'CHILD-1');
});

test('apply pentru prezență scrie direct pe attendance, cheia fiind childId|date', () => {
  const { database, applier } = createHarness();

  applier.apply({
    kind: 'attendance',
    recordId: 'CHILD-1|2026-09-27',
    payload: { status: 'present', reason: '', updatedAt: '2026-09-27T10:00:00.000Z' },
    revision: 1,
    changedAt: '2026-09-27T10:00:00.000Z',
    device: DEVICE,
  });

  const row = /** @type {{ status: string }} */ (
    database.prepare('SELECT * FROM attendance WHERE child_id=? AND date=?').get('CHILD-1', '2026-09-27')
  );
  assert.equal(row.status, 'present');
});

test('apply pentru prezență cu payload null șterge rândul', () => {
  const { database, applier } = createHarness();
  database
    .prepare('INSERT INTO attendance(child_id,date,status,reason,updated_at) VALUES(?,?,?,?,?)')
    .run('CHILD-1', '2026-09-27', 'present', '', '2026-09-27T09:00:00.000Z');

  applier.apply({
    kind: 'attendance',
    recordId: 'CHILD-1|2026-09-27',
    payload: null,
    revision: 2,
    changedAt: '2026-09-27T10:00:00.000Z',
    device: DEVICE,
  });

  const row = database.prepare('SELECT * FROM attendance WHERE child_id=? AND date=?').get('CHILD-1', '2026-09-27');
  assert.equal(row, undefined);
});

test('o fișă cu id invalid întoarce SyncApplyError, nu o eroare oarecare', () => {
  const { applier } = createHarness();

  assert.throws(
    () =>
      applier.apply({
        kind: 'children',
        recordId: 'CHILD-1',
        payload: { id: '###', name: 'Ana' },
        revision: 1,
        changedAt: '2026-09-27T10:00:00.000Z',
        device: DEVICE,
      }),
    SyncApplyError,
  );
});
