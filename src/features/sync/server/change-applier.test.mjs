import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createSyncStateRepository } from './sync-state.repository.mjs';
import { createRecordingAuditTrail } from '#test-support/recording-audit-trail.mjs';
import {
  createChangeApplier,
  createSyncAttendanceWriter,
  createSyncPoolWriter,
  applySnapshotEntry,
  SyncApplyError,
} from './change-applier.mjs';

function createHarness() {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  const rawRecordRepository = createRecordRepository(database);
  const attendanceRepository = createSyncAttendanceWriter(database);
  const poolRepository = createSyncPoolWriter(database);
  const syncState = createSyncStateRepository(database);
  const auditTrail = createRecordingAuditTrail();
  const applier = createChangeApplier({
    rawRecordRepository,
    attendanceRepository,
    poolRepository,
    syncState,
    auditTrail,
  });
  return { database, rawRecordRepository, attendanceRepository, poolRepository, syncState, auditTrail, applier };
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

test('apply ignoră settings/sms_templates fără audit și fără sync_state, până la Faza 6 (C-8)', () => {
  const { auditTrail, syncState, applier } = createHarness();

  const applied = applier.apply({
    kind: 'settings',
    recordId: 'kindergarten',
    payload: { value: { name: 'Grădinița Curcubeul' } },
    revision: 2,
    changedAt: '2026-09-27T10:00:00.000Z',
    device: DEVICE,
  });

  assert.equal(applied, false);
  assert.equal(auditTrail.changes.length, 0);
  assert.equal(syncState.get('settings', 'kindergarten'), undefined);
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

test('AUDIT-COD-02-10-B.md #1: recordId din plic diferit de payload.id respinge modificarea, nu scrie peste altă înregistrare', () => {
  const { rawRecordRepository, applier } = createHarness();
  rawRecordRepository.save('children', { id: 'CHILD-REAL', name: 'Existent' });

  assert.throws(
    () =>
      applier.apply({
        kind: 'children',
        recordId: 'CHILD-FAKE',
        payload: { id: 'CHILD-REAL', name: 'Suprascris pe furiș' },
        revision: 1,
        changedAt: '2026-09-27T10:00:00.000Z',
        device: DEVICE,
      }),
    SyncApplyError,
  );
  assert.equal(rawRecordRepository.find('children', 'CHILD-REAL').name, 'Existent');
});

test('AUDIT-COD-02-10-B.md #1: aceeași verificare se aplică și kind-urilor din setul comun (normalize: false)', () => {
  const { rawRecordRepository, applier } = createHarness();
  rawRecordRepository.save('staff', { id: 'STF-REAL', name: 'Existent' });

  assert.throws(
    () =>
      applier.apply({
        kind: 'staff',
        recordId: 'STF-FAKE',
        payload: { id: 'STF-REAL', name: 'Suprascris pe furiș' },
        revision: 1,
        changedAt: '2026-09-27T10:00:00.000Z',
        device: DEVICE,
      }),
    SyncApplyError,
  );
  assert.equal(rawRecordRepository.find('staff', 'STF-REAL').name, 'Existent');
});

test('applySnapshotEntry scrie prezența dintr-un snapshot fără să apeleze normalizeRecord (C-5)', () => {
  const { database, rawRecordRepository, attendanceRepository } = createHarness();

  const applied = applySnapshotEntry({
    rawRecordRepository,
    attendanceRepository,
    kind: 'attendance',
    recordId: 'CHILD-1|2026-09-27',
    payload: { status: 'present', reason: '', updatedAt: '2026-09-27T10:00:00.000Z' },
  });

  assert.equal(applied, true);
  const row = /** @type {{ status: string }} */ (
    database.prepare('SELECT * FROM attendance WHERE child_id=? AND date=?').get('CHILD-1', '2026-09-27')
  );
  assert.equal(row.status, 'present');
});

test('applySnapshotEntry scrie o fișă și întoarce fals pentru un tip netratat (sms_templates/settings)', () => {
  const { rawRecordRepository, attendanceRepository } = createHarness();

  assert.equal(
    applySnapshotEntry({
      rawRecordRepository,
      attendanceRepository,
      kind: 'children',
      recordId: 'CHILD-1',
      payload: { id: 'CHILD-1', name: 'Ana' },
    }),
    true,
  );
  assert.equal(rawRecordRepository.find('children', 'CHILD-1').name, 'Ana');

  assert.equal(
    applySnapshotEntry({
      rawRecordRepository,
      attendanceRepository,
      kind: 'settings',
      recordId: 'kindergarten',
      payload: { value: {} },
    }),
    false,
  );
});

const BOOKING = {
  id: 'PB-1',
  childId: 'C-1',
  coachId: 'STF-1',
  weekday: 2,
  time: '09:00',
  startDate: '2026-09-01',
  endDate: null,
  archivedAt: null,
  updatedAt: '2026-09-01T00:00:00Z',
};

test('apply pentru pool_bookings scrie direct pe pool_bookings', () => {
  const { database, applier } = createHarness();

  applier.apply({
    kind: 'pool_bookings',
    recordId: BOOKING.id,
    payload: BOOKING,
    revision: 1,
    changedAt: '2026-09-27T10:00:00.000Z',
    device: DEVICE,
  });

  const row = /** @type {{ coach_id: string }} */ (
    database.prepare('SELECT * FROM pool_bookings WHERE id=?').get(BOOKING.id)
  );
  assert.equal(row.coach_id, 'STF-1');
});

test('apply pentru pool_bookings cu payload null șterge rândul', () => {
  const { database, applier } = createHarness();
  applier.apply({
    kind: 'pool_bookings',
    recordId: BOOKING.id,
    payload: BOOKING,
    revision: 1,
    changedAt: '2026-09-27T10:00:00.000Z',
    device: DEVICE,
  });

  applier.apply({
    kind: 'pool_bookings',
    recordId: BOOKING.id,
    payload: null,
    revision: 2,
    changedAt: '2026-09-27T10:01:00.000Z',
    device: DEVICE,
  });

  assert.equal(database.prepare('SELECT * FROM pool_bookings WHERE id=?').get(BOOKING.id), undefined);
});

test('apply pentru pool_sessions scrie pe pool_sessions, cheia fiind bookingId|date', () => {
  const { database, applier } = createHarness();

  applier.apply({
    kind: 'pool_sessions',
    recordId: 'PB-1|2026-09-08',
    payload: { status: 'present', updatedAt: '2026-09-08T10:00:00.000Z' },
    revision: 1,
    changedAt: '2026-09-27T10:00:00.000Z',
    device: DEVICE,
  });

  const row = /** @type {{ status: string }} */ (
    database.prepare('SELECT * FROM pool_sessions WHERE booking_id=? AND date=?').get('PB-1', '2026-09-08')
  );
  assert.equal(row.status, 'present');
});

test('apply pentru pool_sessions cu payload null șterge rândul', () => {
  const { database, applier } = createHarness();
  database
    .prepare('INSERT INTO pool_sessions(booking_id,date,status,updated_at) VALUES(?,?,?,?)')
    .run('PB-1', '2026-09-08', 'present', '2026-09-08T10:00:00.000Z');

  applier.apply({
    kind: 'pool_sessions',
    recordId: 'PB-1|2026-09-08',
    payload: null,
    revision: 2,
    changedAt: '2026-09-27T10:01:00.000Z',
    device: DEVICE,
  });

  assert.equal(
    database.prepare('SELECT * FROM pool_sessions WHERE booking_id=? AND date=?').get('PB-1', '2026-09-08'),
    undefined,
  );
});

test('apply pentru pool_closings scrie pe pool_closings, cheia fiind luna', () => {
  const { database, applier } = createHarness();

  applier.apply({
    kind: 'pool_closings',
    recordId: '2026-09',
    payload: { month: '2026-09', closedAt: '2026-09-30T12:00:00.000Z' },
    revision: 1,
    changedAt: '2026-09-27T10:00:00.000Z',
    device: DEVICE,
  });

  const row = /** @type {{ closed_at: string }} */ (
    database.prepare('SELECT * FROM pool_closings WHERE month=?').get('2026-09')
  );
  assert.equal(row.closed_at, '2026-09-30T12:00:00.000Z');
});

test('applySnapshotEntry scrie o programare de bazin dintr-un snapshot', () => {
  const { database, rawRecordRepository, attendanceRepository, poolRepository } = createHarness();

  const applied = applySnapshotEntry({
    rawRecordRepository,
    attendanceRepository,
    poolRepository,
    kind: 'pool_bookings',
    recordId: BOOKING.id,
    payload: BOOKING,
  });

  assert.equal(applied, true);
  const row = database.prepare('SELECT * FROM pool_bookings WHERE id=?').get(BOOKING.id);
  assert.ok(row);
});

test('applySnapshotEntry fără poolRepository injectat întoarce fals pentru un kind de bazin (compatibilitate)', () => {
  const { rawRecordRepository, attendanceRepository } = createHarness();

  assert.equal(
    applySnapshotEntry({
      rawRecordRepository,
      attendanceRepository,
      kind: 'pool_bookings',
      recordId: BOOKING.id,
      payload: BOOKING,
    }),
    false,
  );
});

/** Fals minimal cu `mergeSyncedEntry` — `createRecordingAuditTrail` (tests/support) n-are
 * nevoie de el pentru restul testelor (doar `recordChange`), ca în `change-applier.mjs`.
 * `recordChange` rămâne neapelat aici (applySnapshotEntry pentru audit_log nu-l folosește
 * niciodată), dar tipul `AuditTrail` îl cere. */
function createMergingAuditTrail() {
  /** @type {any[]} */
  const merged = [];
  return {
    recordChange: () => {
      throw new Error('recordChange n-ar trebui apelat pentru un audit_log din instantaneu.');
    },
    mergeSyncedEntry: entry => void merged.push(structuredClone(entry)),
    merged,
  };
}

const SNAPSHOT_AUDIT_PAYLOAD = {
  action: 'modificare',
  recordType: 'children',
  recordId: 'CHILD-1',
  before: { name: 'Vechi' },
  after: { name: 'Ana' },
  occurredAt: '2026-09-27T09:00:00.000Z',
};

test('applySnapshotEntry (§5/punctul 1): un audit_log din instantaneu scrie prin mergeSyncedEntry, cu identitatea din `device`, nu din payload, și întoarce fals', () => {
  const { rawRecordRepository, attendanceRepository } = createHarness();
  const auditTrail = createMergingAuditTrail();

  const applied = applySnapshotEntry({
    rawRecordRepository,
    attendanceRepository,
    auditTrail,
    kind: 'audit_log',
    recordId: 'ENTRY-UID-1',
    // deviceId/deviceName auto-raportate în payload — NU trebuie folosite (vezi `device` mai jos).
    payload: { ...SNAPSHOT_AUDIT_PAYLOAD, deviceId: 'pretins-alt-calculator', deviceName: 'Pretins' },
    device: { id: 'dev-a', name: 'Calculator A' },
    changedAt: '2026-09-27T10:00:00.000Z',
  });

  assert.equal(applied, false, 'nimic de scris prin depozitul brut pentru audit_log');
  assert.equal(auditTrail.merged.length, 1);
  assert.deepEqual(auditTrail.merged[0], {
    entryUid: 'ENTRY-UID-1',
    deviceId: 'dev-a',
    deviceName: 'Calculator A',
    action: 'modificare',
    recordType: 'children',
    recordId: 'CHILD-1',
    before: { name: 'Vechi' },
    after: { name: 'Ana' },
    occurredAt: '2026-09-27T09:00:00.000Z',
  });
});

test('applySnapshotEntry pentru audit_log fără `occurredAt` în payload cade pe `changedAt`', () => {
  const { rawRecordRepository, attendanceRepository } = createHarness();
  const auditTrail = createMergingAuditTrail();

  applySnapshotEntry({
    rawRecordRepository,
    attendanceRepository,
    auditTrail,
    kind: 'audit_log',
    recordId: 'ENTRY-UID-2',
    payload: { ...SNAPSHOT_AUDIT_PAYLOAD, occurredAt: undefined },
    device: { id: 'dev-a', name: 'Calculator A' },
    changedAt: '2026-09-27T10:00:00.000Z',
  });

  assert.equal(auditTrail.merged[0].occurredAt, '2026-09-27T10:00:00.000Z');
});

test('applySnapshotEntry pentru audit_log fără auditTrail injectat (compatibilitate) nu aruncă', () => {
  const { rawRecordRepository, attendanceRepository } = createHarness();

  assert.doesNotThrow(() =>
    applySnapshotEntry({
      rawRecordRepository,
      attendanceRepository,
      kind: 'audit_log',
      recordId: 'ENTRY-UID-3',
      payload: SNAPSHOT_AUDIT_PAYLOAD,
      device: { id: 'dev-a', name: 'Calculator A' },
      changedAt: '2026-09-27T10:00:00.000Z',
    }),
  );
});

test('applySnapshotEntry pentru audit_log fără `device` (fals de test simplu) scrie identitate goală, nu aruncă', () => {
  const { rawRecordRepository, attendanceRepository } = createHarness();
  const auditTrail = createMergingAuditTrail();

  applySnapshotEntry({
    rawRecordRepository,
    attendanceRepository,
    auditTrail,
    kind: 'audit_log',
    recordId: 'ENTRY-UID-4',
    payload: SNAPSHOT_AUDIT_PAYLOAD,
  });

  assert.equal(auditTrail.merged[0].deviceId, '');
  assert.equal(auditTrail.merged[0].deviceName, '');
});
