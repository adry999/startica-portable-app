import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import { createRecordingAuditTrail } from '#test-support/recording-audit-trail.mjs';
import { createSyncOutboxRepository } from './sync-outbox.repository.mjs';
import { createSyncStateRepository } from './sync-state.repository.mjs';
import { createSyncConflictsRepository } from './sync-conflicts.repository.mjs';
import { createSyncAttendanceWriter } from './change-applier.mjs';
import { SyncNetworkError, SyncRevokedError, SyncHttpError } from './sync-http-client.mjs';
import { createSyncEngine } from './sync-engine.service.mjs';

const DEVICE_ID = 'dev-a';

/** @param {Partial<Record<'pushChanges' | 'pullChanges' | 'downloadSnapshot' | 'openEvents', Function>>} overrides */
function fakeClient(overrides = {}) {
  return {
    pushChanges: async () => ({ results: [] }),
    pullChanges: async () => ({ changes: [], nextSince: 0, headSeq: 0 }),
    downloadSnapshot: async () => {
      throw new Error('downloadSnapshot nu era așteptat în acest test.');
    },
    openEvents: () => ({ close: () => {} }),
    ...overrides,
  };
}

/** @param {any} [options] */
function createHarness({ client = fakeClient(), ...engineOverrides } = {}) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  const rawRecordRepository = createRecordRepository(database);
  const settings = createSettingsRepository(database);
  const outbox = createSyncOutboxRepository(database, { now: () => new Date('2026-09-27T10:00:00.000Z') });
  const syncState = createSyncStateRepository(database);
  const conflicts = createSyncConflictsRepository(database, { now: () => new Date('2026-09-27T10:00:00.000Z') });
  const attendanceRepository = createSyncAttendanceWriter(database);
  const auditTrail = createRecordingAuditTrail();
  const readSetting = /** @type {(key: string) => string} */ (settings.setting);

  const statuses = [];
  const recordsChangedRevisions = [];
  const engine = createSyncEngine({
    database,
    branch: { id: 'branch-1' },
    rawRecordRepository,
    outbox,
    syncState,
    conflicts,
    auditTrail,
    readSetting,
    writeSetting: settings.setSetting,
    attendanceRepository,
    client: /** @type {ReturnType<typeof import('./sync-http-client.mjs').createSyncHttpClient>} */ (client),
    deviceId: DEVICE_ID,
    deviceName: 'Calculator A',
    now: () => new Date('2026-09-27T10:00:00.000Z'),
    onStatus: s => statuses.push(s),
    onRecordsChanged: revision => recordsChangedRevisions.push(revision),
    ...engineOverrides,
  });

  return {
    database,
    rawRecordRepository,
    outbox,
    syncState,
    conflicts,
    auditTrail,
    engine,
    statuses,
    recordsChangedRevisions,
  };
}

test('un push aplicat golește outbox-ul și scrie revizia în sync_state', async () => {
  const { outbox, syncState, engine } = createHarness({
    client: fakeClient({
      pushChanges: async (_branchId, changes) => ({
        results: changes.map(change => ({ changeId: change.changeId, status: 'applied', revision: 1 })),
      }),
    }),
  });
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana' } });

  await engine.syncNow();

  assert.equal(outbox.countPending(), 0);
  assert.equal(/** @type {{ serverRevision: number }} */ (syncState.get('children', 'CHILD-1')).serverRevision, 1);
  assert.equal(engine.status().pending, 0);
});

test('un conflict parchează rândul din outbox și creează un conflict cu ambele variante', async () => {
  const { outbox, conflicts, engine } = createHarness({
    client: fakeClient({
      pushChanges: async (_branchId, changes) => ({
        results: changes.map(change => ({
          changeId: change.changeId,
          status: 'conflict',
          revision: 4,
          head: {
            payload: { id: 'CHILD-1', name: 'Ana (server)' },
            revision: 4,
            updatedAt: '2026-09-27T09:00:00.000Z',
            updatedBy: { id: 'dev-b', name: 'Calculator B' },
          },
        })),
      }),
    }),
  });
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana (local)' } });

  await engine.syncNow();

  assert.equal(outbox.pending().length, 0, 'rândul e parcat, nu mai pending');
  const conflict = /** @type {import('../sync.types.d.mts').SyncConflictEntry} */ (conflicts.list()[0]);
  assert.equal(conflict.kind, 'children');
  assert.deepEqual(conflict.localPayload, { id: 'CHILD-1', name: 'Ana (local)' });
  assert.deepEqual(conflict.remotePayload, { id: 'CHILD-1', name: 'Ana (server)' });
  assert.equal(conflict.remoteDeviceName, 'Calculator B');
  assert.equal(engine.status().conflicts, 1);
});

test('pull aplică modificările altora prin normalizeRecord, sare peste ale mele și crește meta.revision o singură dată', async () => {
  const { database, rawRecordRepository, recordsChangedRevisions, engine } = createHarness({
    client: fakeClient({
      pullChanges: async () => ({
        changes: [
          {
            seq: 1,
            changeId: 'c-mine',
            kind: 'children',
            recordId: 'CHILD-MINE',
            revision: 1,
            payload: { id: 'CHILD-MINE', name: 'Nu se aplică' },
            changedAt: '2026-09-27T09:00:00.000Z',
            device: { id: DEVICE_ID, name: 'Calculator A' },
          },
          {
            seq: 2,
            changeId: 'c-1',
            kind: 'children',
            recordId: 'CHILD-1',
            revision: 1,
            payload: { id: 'CHILD-1', name: 'Ana', unknownField: 'x' },
            changedAt: '2026-09-27T09:00:00.000Z',
            device: { id: 'dev-b', name: 'Calculator B' },
          },
          {
            seq: 3,
            changeId: 'c-2',
            kind: 'children',
            recordId: 'CHILD-2',
            revision: 1,
            payload: { id: 'CHILD-2', name: 'Bogdan' },
            changedAt: '2026-09-27T09:05:00.000Z',
            device: { id: 'dev-b', name: 'Calculator B' },
          },
        ],
        nextSince: 3,
        headSeq: 3,
      }),
    }),
  });

  await engine.syncNow();

  assert.equal(rawRecordRepository.find('children', 'CHILD-MINE'), undefined);
  assert.equal(rawRecordRepository.find('children', 'CHILD-1').name, 'Ana');
  assert.equal(rawRecordRepository.find('children', 'CHILD-1').unknownField, undefined);
  assert.equal(rawRecordRepository.find('children', 'CHILD-2').name, 'Bogdan');
  const meta = /** @type {{ revision: number }} */ (database.prepare('SELECT revision FROM meta WHERE id=1').get());
  assert.equal(meta.revision, 1);
  assert.deepEqual(recordsChangedRevisions, [1]);
});

test('o eroare de rețea trece în offline cu backoff, 401 în revocat și oprește timerele', async () => {
  const timerCalls = { setInterval: 0, clearInterval: 0, setTimeout: 0, clearTimeout: 0 };
  const { engine } = createHarness({
    client: fakeClient({
      pullChanges: async () => {
        throw new SyncNetworkError('ECONNREFUSED');
      },
    }),
    setIntervalFn: () => {
      timerCalls.setInterval += 1;
      return { unref() {} };
    },
    clearIntervalFn: () => {
      timerCalls.clearInterval += 1;
    },
    setTimeoutFn: () => {
      timerCalls.setTimeout += 1;
      return { unref() {} };
    },
    clearTimeoutFn: () => {
      timerCalls.clearTimeout += 1;
    },
  });

  engine.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(engine.status().connection, 'offline');
  assert.ok(timerCalls.setTimeout >= 1, 'un backoff a fost programat');

  engine.stop();
  assert.ok(timerCalls.clearInterval >= 1, 'polling-ul a fost oprit la stop()');
  assert.ok(timerCalls.clearTimeout >= 1, 'backoff-ul a fost anulat la stop()');

  let sseClosed = false;
  const timerCalls2 = { clearInterval: 0 };
  const { engine: revokedEngine } = createHarness({
    client: fakeClient({
      pullChanges: async () => {
        throw new SyncRevokedError('device-revoked');
      },
      openEvents: () => ({
        close: () => {
          sseClosed = true;
        },
      }),
    }),
    setIntervalFn: () => ({ unref() {} }),
    clearIntervalFn: () => {
      timerCalls2.clearInterval += 1;
    },
  });

  revokedEngine.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(revokedEngine.status().connection, 'revoked');
  assert.ok(timerCalls2.clearInterval >= 1, 'timerul de polling a fost oprit automat la 401');
  assert.equal(sseClosed, true, 'conexiunea SSE a fost închisă');
});

test('410 reface filiala din snapshot', async () => {
  const { database, rawRecordRepository, syncState, recordsChangedRevisions, engine } = createHarness({
    client: fakeClient({
      pullChanges: async () => {
        throw new SyncHttpError(410, 'cursor-expirat');
      },
      downloadSnapshot: async () => ({
        records: {
          children: [
            {
              id: 'CHILD-1',
              revision: 5,
              payload: { id: 'CHILD-1', name: 'Ana' },
              updatedAt: '2026-09-27T09:00:00.000Z',
            },
          ],
        },
        headSeq: 5,
      }),
    }),
  });

  await engine.syncNow();

  assert.equal(rawRecordRepository.find('children', 'CHILD-1').name, 'Ana');
  assert.equal(/** @type {{ serverRevision: number }} */ (syncState.get('children', 'CHILD-1')).serverRevision, 5);
  const meta = /** @type {{ revision: number }} */ (database.prepare('SELECT revision FROM meta WHERE id=1').get());
  assert.equal(meta.revision, 1);
  assert.deepEqual(recordsChangedRevisions, [1]);
});
