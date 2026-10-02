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

/** @param {Partial<Record<'pushChanges' | 'pullChanges' | 'downloadSnapshot' | 'openEvents' | 'fetchMyProfile', Function>>} overrides */
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

/** Un `backups` fals care înregistrează motivele — evită depinderea de VACUUM INTO în teste. */
function fakeBackups() {
  const reasons = [];
  return {
    reasons,
    backup(reason) {
      reasons.push(reason);
      return { file: '', name: '', warning: '' };
    },
  };
}

/** @param {any} [options] */
function createHarness({ client = fakeClient(), backups = fakeBackups(), ...engineOverrides } = {}) {
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
    backups,
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
    backups,
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

test('o modificare locală apărută în timpul unui push în zbor rămâne pending, nu se pierde (C-1)', async () => {
  const pushGate = Promise.withResolvers();
  const { outbox, engine } = createHarness({
    client: fakeClient({
      pushChanges: async (_branchId, changes) => {
        await pushGate.promise;
        return { results: changes.map(change => ({ changeId: change.changeId, status: 'applied', revision: 1 })) };
      },
    }),
  });
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana' } });

  const syncPromise = engine.syncNow();
  // Salvare locală nouă chiar în fereastra în care push-ul primei modificări e „în zbor”
  // (await client.pushChanges de mai sus nu s-a rezolvat încă) — scenariul exact din audit.
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana Popescu' } });
  pushGate.resolve(undefined);
  await syncPromise;

  assert.equal(outbox.countPending(), 1, 'modificarea nouă a rămas în coadă, nu s-a pierdut');
  assert.deepEqual(outbox.pending()[0].payload, { id: 'CHILD-1', name: 'Ana Popescu' });
});

test('un rând parcat nu e suprascris de pull; conflictul își actualizează varianta de pe server (C-3)', async () => {
  const { outbox, conflicts, rawRecordRepository, engine } = createHarness({
    client: fakeClient({
      pullChanges: async () => ({
        changes: [
          {
            seq: 10,
            changeId: 'c-de-pe-c',
            kind: 'children',
            recordId: 'CHILD-1',
            revision: 6,
            payload: { id: 'CHILD-1', name: 'Ana (server, a treia oară)' },
            changedAt: '2026-09-27T09:30:00.000Z',
            device: { id: 'dev-c', name: 'Calculator C' },
          },
        ],
        nextSince: 10,
        headSeq: 10,
      }),
    }),
  });
  rawRecordRepository.save('children', { id: 'CHILD-1', name: 'Ana (local, cu conflict)' });
  outbox.enqueue({
    kind: 'children',
    recordId: 'CHILD-1',
    payload: { id: 'CHILD-1', name: 'Ana (local, cu conflict)' },
  });
  const [{ seq, changeId }] = outbox.pending();
  const conflictId = conflicts.insert({
    kind: 'children',
    recordId: 'CHILD-1',
    localPayload: { id: 'CHILD-1', name: 'Ana (local, cu conflict)' },
    localUpdatedAt: '2026-09-27T09:00:00.000Z',
    remotePayload: { id: 'CHILD-1', name: 'Ana (server, veche)' },
    remoteRevision: 4,
    remoteUpdatedAt: '2026-09-27T08:00:00.000Z',
    remoteDeviceId: 'dev-b',
    remoteDeviceName: 'Calculator B',
    outboxSeq: seq,
  });
  outbox.park(seq, changeId);

  await engine.syncNow();

  assert.equal(
    rawRecordRepository.find('children', 'CHILD-1').name,
    'Ana (local, cu conflict)',
    'varianta locală nu s-a schimbat',
  );
  const conflict = /** @type {import('../sync.types.d.mts').SyncConflictEntry} */ (conflicts.find(conflictId));
  assert.deepEqual(conflict.remotePayload, { id: 'CHILD-1', name: 'Ana (server, a treia oară)' });
  assert.equal(conflict.remoteRevision, 6);
  assert.equal(conflict.remoteDeviceName, 'Calculator C');
});

test('superseded scrie capul serverului, crește meta.revision și notifică o singură dată (C-4)', async () => {
  const { database, rawRecordRepository, recordsChangedRevisions, outbox, engine } = createHarness({
    client: fakeClient({
      pushChanges: async (_branchId, changes) => ({
        results: changes.map(change => ({
          changeId: change.changeId,
          status: 'superseded',
          head: {
            payload: { id: 'CHILD-1', name: 'Remote' },
            revision: 3,
            updatedAt: '2026-09-27T09:00:00.000Z',
            updatedBy: { id: 'dev-b', name: 'Calculator B' },
          },
        })),
      }),
    }),
  });
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Local' } });
  const metaBefore = /** @type {{ revision: number }} */ (
    database.prepare('SELECT revision FROM meta WHERE id=1').get()
  ).revision;

  await engine.syncNow();

  assert.equal(rawRecordRepository.find('children', 'CHILD-1').name, 'Remote');
  assert.equal(outbox.countPending(), 0);
  const metaAfter = /** @type {{ revision: number }} */ (database.prepare('SELECT revision FROM meta WHERE id=1').get())
    .revision;
  assert.equal(metaAfter, metaBefore + 1);
  assert.deepEqual(recordsChangedRevisions, [metaAfter]);
});

test('superseded fără head șterge rândul din outbox, nu-l ține pending la nesfârșit (D-2)', async () => {
  const { outbox, engine } = createHarness({
    client: fakeClient({
      pushChanges: async (_branchId, changes) => ({
        // Reluarea unui changeId cu rezultat „superseded” poate întoarce fără head
        // (serverul îl retrimite doar la primul rezultat) — vezi D-2.
        results: changes.map(change => ({ changeId: change.changeId, status: 'superseded' })),
      }),
    }),
  });
  outbox.enqueue({ kind: 'payments', recordId: 'PAY-1', payload: { id: 'PAY-1', amount: 100 } });

  await engine.syncNow();

  assert.equal(outbox.countPending(), 0, 'rândul nu rămâne pending la nesfârșit');
});

test('bumpRevision scrie și meta.updated_at, nu doar revision (C-7)', async () => {
  const { database, engine } = createHarness({
    now: () => new Date('2026-09-27T12:00:00.000Z'),
    client: fakeClient({
      pullChanges: async () => ({
        changes: [
          {
            seq: 1,
            changeId: 'c-1',
            kind: 'children',
            recordId: 'CHILD-1',
            revision: 1,
            payload: { id: 'CHILD-1', name: 'Ana' },
            changedAt: '2026-09-27T09:00:00.000Z',
            device: { id: 'dev-b', name: 'Calculator B' },
          },
        ],
        nextSince: 1,
        headSeq: 1,
      }),
    }),
  });

  await engine.syncNow();

  const meta = /** @type {{ updated_at: string }} */ (database.prepare('SELECT updated_at FROM meta WHERE id=1').get());
  assert.equal(meta.updated_at, '2026-09-27T12:00:00.000Z');
});

test('o eroare care nu e de rețea programează totuși un backoff (C-9)', async () => {
  const timerCalls = { setTimeout: 0 };
  const { engine } = createHarness({
    client: fakeClient({
      pullChanges: async () => {
        throw new SyncHttpError(404, 'filiala neînregistrată');
      },
    }),
    setIntervalFn: () => ({ unref() {} }),
    setTimeoutFn: () => {
      timerCalls.setTimeout += 1;
      return { unref() {} };
    },
  });

  engine.start();
  await new Promise(resolve => setImmediate(resolve));

  assert.ok(timerCalls.setTimeout >= 1, 'un backoff a fost programat și pentru o eroare HTTP generică');
  engine.stop();
});

test('resincronizarea din snapshot face backup înainte, tratează prezența și păstrează un rând cu conflict parcat (C-5)', async () => {
  const { database, rawRecordRepository, backups, outbox, recordsChangedRevisions, engine } = createHarness({
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
              payload: { id: 'CHILD-1', name: 'Ana (server)' },
              updatedAt: '2026-09-27T09:00:00.000Z',
            },
            {
              id: 'CHILD-2',
              revision: 2,
              payload: { id: 'CHILD-2', name: 'Server ar suprascrie conflictul' },
              updatedAt: '2026-09-27T09:00:00.000Z',
            },
          ],
          attendance: [
            {
              id: 'CHILD-1|2026-09-27',
              revision: 1,
              payload: { status: 'present', reason: '', updatedAt: '2026-09-27T08:00:00.000Z' },
              updatedAt: '2026-09-27T08:00:00.000Z',
            },
          ],
        },
        headSeq: 9,
      }),
    }),
  });
  // CHILD-2 are o editare locală cu conflict parcat — resincronizarea nu trebuie să o piardă.
  rawRecordRepository.save('children', { id: 'CHILD-2', name: 'Local, cu conflict' });
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-2', payload: { id: 'CHILD-2', name: 'Local, cu conflict' } });
  const [{ seq: seqChild2, changeId: changeIdChild2 }] = outbox.pending();
  outbox.park(seqChild2, changeIdChild2);

  await engine.syncNow();

  assert.deepEqual(backups.reasons, ['inainte-resincronizare']);
  assert.equal(rawRecordRepository.find('children', 'CHILD-1').name, 'Ana (server)');
  assert.equal(
    rawRecordRepository.find('children', 'CHILD-2').name,
    'Local, cu conflict',
    'conflictul parcat nu a fost suprascris',
  );
  const attendanceRow = /** @type {{ status: string }} */ (
    database.prepare('SELECT * FROM attendance WHERE child_id=? AND date=?').get('CHILD-1', '2026-09-27')
  );
  assert.equal(attendanceRow.status, 'present');
  assert.ok(recordsChangedRevisions.length >= 1);
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

test('§5 (PROMPT-CLAUDE-CODE-10, punctul 1): 410 aplică un audit_log din instantaneu prin mergeSyncedEntry, cu identitatea din `updatedBy` al rândului, nu scrie nimic prin depozitul brut', async () => {
  /** @type {any[]} */
  const merged = [];
  // Fals local, nu createRecordingAuditTrail (acela n-are mergeSyncedEntry) — suficient
  // pentru acest test, ca în change-applier.test.mjs.
  const customAuditTrail = { recordChange: () => {}, mergeSyncedEntry: entry => void merged.push(entry) };
  const { rawRecordRepository, syncState, engine } = createHarness({
    auditTrail: customAuditTrail,
    client: fakeClient({
      pullChanges: async () => {
        throw new SyncHttpError(410, 'cursor-expirat');
      },
      downloadSnapshot: async () => ({
        records: {
          audit_log: [
            {
              id: 'ENTRY-UID-1',
              revision: 1,
              payload: {
                action: 'modificare',
                recordType: 'children',
                recordId: 'CHILD-1',
                before: null,
                after: { id: 'CHILD-1', name: 'Ana' },
                occurredAt: '2026-09-27T08:00:00.000Z',
              },
              updatedAt: '2026-09-27T08:30:00.000Z',
              updatedBy: { id: 'dev-b', name: 'Calculator B' },
            },
          ],
        },
        headSeq: 1,
      }),
    }),
  });

  await engine.syncNow();

  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0], {
    entryUid: 'ENTRY-UID-1',
    deviceId: 'dev-b',
    deviceName: 'Calculator B',
    action: 'modificare',
    recordType: 'children',
    recordId: 'CHILD-1',
    before: null,
    after: { id: 'CHILD-1', name: 'Ana' },
    occurredAt: '2026-09-27T08:00:00.000Z',
  });
  assert.equal(
    rawRecordRepository.find('children', 'CHILD-1'),
    undefined,
    'audit_log nu scrie nimic prin depozitul brut',
  );
  assert.equal(syncState.get('audit_log', 'ENTRY-UID-1'), undefined, 'fără sync_state pentru audit_log, ca la pull');
});

test('S-4: o resincronizare 410 a setului comun nu șterge candidates — kind comun, ca staff', async () => {
  const { rawRecordRepository, engine } = createHarness({
    client: fakeClient({
      pullChanges: async () => {
        throw new SyncHttpError(410, 'cursor-expirat');
      },
      // Reproducerea auditului (v3-comun-410.mjs): 1 staff + 2 candidates înainte de 410 —
      // dacă `candidates` lipsește din COMMON_KINDS (change-applier.mjs), applySnapshotEntry
      // întoarce fals pentru el chiar dacă e în instantaneul serverului, iar DELETE FROM
      // records (rulat necondiționat mai sus în resyncFromSnapshot) le șterge fără să le
      // mai rescrie — candidates 2 → 0, fără niciun mesaj.
      downloadSnapshot: async () => ({
        records: {
          staff: [
            {
              id: 'STF-1',
              revision: 3,
              payload: { id: 'STF-1', name: 'Ana Popescu' },
              updatedAt: '2026-09-27T09:00:00.000Z',
            },
          ],
          candidates: [
            {
              id: 'CAND-1',
              revision: 1,
              payload: { id: 'CAND-1', name: 'Maria Ionescu' },
              updatedAt: '2026-09-27T09:00:00.000Z',
            },
            {
              id: 'CAND-2',
              revision: 1,
              payload: { id: 'CAND-2', name: 'Elena Rusu' },
              updatedAt: '2026-09-27T09:00:00.000Z',
            },
          ],
        },
        headSeq: 4,
      }),
    }),
  });
  // Starea locală dinaintea 410-ului — aceeași bază, cu 1 staff + 2 candidates.
  rawRecordRepository.save('staff', { id: 'STF-1', name: 'Ana Popescu' });
  rawRecordRepository.save('candidates', { id: 'CAND-1', name: 'Maria Ionescu' });
  rawRecordRepository.save('candidates', { id: 'CAND-2', name: 'Elena Rusu' });

  await engine.syncNow();

  assert.ok(rawRecordRepository.find('staff', 'STF-1'), 'staff supraviețuiește (era deja în COMMON_KINDS)');
  assert.ok(rawRecordRepository.find('candidates', 'CAND-1'), 'primul candidat supraviețuiește resincronizării');
  assert.ok(rawRecordRepository.find('candidates', 'CAND-2'), 'al doilea candidat supraviețuiește resincronizării');
});

// §5.3 (36g) — profilul calculatorului, reîmprospătat la fiecare ciclu

test('syncNow reîmprospătează profilul de pe server și îl expune în status()', async () => {
  const profile = { preset: 'educator', modules: {}, pinModules: [], blocked: false };
  const written = [];
  const { engine } = createHarness({
    client: fakeClient({ fetchMyProfile: async () => ({ profile }) }),
    writeProfile: p => written.push(p),
  });

  await engine.syncNow();

  assert.deepEqual(engine.status().profile, profile);
  assert.deepEqual(written, [profile]);
});

test('syncNow nu aruncă dacă clientul nu are fetchMyProfile (server vechi, fără §5.3)', async () => {
  const { engine } = createHarness({ client: fakeClient() });
  await assert.doesNotReject(() => engine.syncNow());
  assert.equal(engine.status().profile, null);
});

test('syncNow păstrează ultimul profil cunoscut dacă reîmprospătarea eșuează', async () => {
  const profile = { preset: 'bazin', modules: {}, pinModules: [], blocked: false };
  let callCount = 0;
  const { engine } = createHarness({
    client: fakeClient({
      fetchMyProfile: async () => {
        callCount += 1;
        if (callCount === 1) return { profile };
        throw new Error('rețea picată');
      },
    }),
  });

  await engine.syncNow();
  assert.deepEqual(engine.status().profile, profile);
  await engine.syncNow();
  assert.deepEqual(engine.status().profile, profile, 'profilul anterior rămâne, nu dispare la o eroare');
});
