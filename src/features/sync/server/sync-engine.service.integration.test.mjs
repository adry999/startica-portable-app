import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createSyncServer } from '#sync-server/create-sync-server.mjs';
import { applySchema } from '#core/server/database/schema.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import { createRecordingAuditTrail } from '#test-support/recording-audit-trail.mjs';
import { createSyncOutboxRepository } from './sync-outbox.repository.mjs';
import { createSyncStateRepository } from './sync-state.repository.mjs';
import { createSyncConflictsRepository } from './sync-conflicts.repository.mjs';
import { createSyncAttendanceWriter } from './change-applier.mjs';
import { createSyncHttpClient } from './sync-http-client.mjs';
import { createSyncEngine } from './sync-engine.service.mjs';

const SETUP_KEY = 'cheie-dev-integrare';

/** @param {import('node:test').TestContext} t */
async function startRealServer(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'sync-server-engine-integration-'));
  const app = createSyncServer({
    config: {
      port: 0,
      bind: '127.0.0.1',
      dataDir,
      setupKey: SETUP_KEY,
      setupKeyAlways: true,
      backupHour: 3,
      backupKeep: 14,
      historyDays: 365,
      trustProxy: false,
    },
    log: () => {},
  });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const { port } = /** @type {import('node:net').AddressInfo} */ (app.server.address());
  const origin = `http://127.0.0.1:${port}`;
  t.after(async () => {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  });
  return { origin };
}

/** Un `backups` fals — evită VACUUM INTO pe o bază `:memory:` în teste de integrare. */
function fakeBackups() {
  return { backup: () => ({ file: '', name: '', warning: '' }) };
}

/** O „filială” minimală, cu propria bază SQLite în memorie — echivalentul unui calculator conectat. */
function createDeviceHarness({ branchId, deviceId, deviceName, client, outboxNow }) {
  const database = new DatabaseSync(':memory:');
  applySchema(database);
  const rawRecordRepository = createRecordRepository(database);
  const settings = createSettingsRepository(database);
  const outbox = createSyncOutboxRepository(database, outboxNow ? { now: outboxNow } : undefined);
  const syncState = createSyncStateRepository(database);
  const conflicts = createSyncConflictsRepository(database);
  const attendanceRepository = createSyncAttendanceWriter(database);
  const auditTrail = createRecordingAuditTrail();
  const engine = createSyncEngine({
    database,
    branch: { id: branchId },
    rawRecordRepository,
    outbox,
    syncState,
    conflicts,
    backups: fakeBackups(),
    auditTrail,
    readSetting: settings.setting,
    writeSetting: settings.setSetting,
    attendanceRepository,
    client,
    deviceId,
    deviceName,
  });
  return { database, rawRecordRepository, outbox, syncState, conflicts, engine };
}

test('push urmat de pull de pe un al doilea dispozitiv aduce aceeași înregistrare', async t => {
  const { origin } = await startRealServer(t);
  const branchId = 'branch-integrare-1';

  const pairingClientA = createSyncHttpClient({ serverUrl: origin, fetch: globalThis.fetch });
  const deviceA = await pairingClientA.pair({ setupKey: SETUP_KEY, name: 'Calculator A', os: 'Windows 11' });
  const clientA = createSyncHttpClient({ serverUrl: origin, token: deviceA.token, fetch: globalThis.fetch });
  await clientA.registerBranch({
    id: branchId,
    name: 'Filiala principală',
    color: 'orange',
    address: '',
    createdAt: '2026-09-27T08:00:00.000Z',
  });

  const pairingClientB = createSyncHttpClient({ serverUrl: origin, fetch: globalThis.fetch });
  const deviceB = await pairingClientB.pair({ setupKey: SETUP_KEY, name: 'Calculator B', os: 'macOS' });
  const clientB = createSyncHttpClient({ serverUrl: origin, token: deviceB.token, fetch: globalThis.fetch });

  const harnessA = createDeviceHarness({
    branchId,
    deviceId: deviceA.deviceId,
    deviceName: 'Calculator A',
    client: clientA,
  });
  const harnessB = createDeviceHarness({
    branchId,
    deviceId: deviceB.deviceId,
    deviceName: 'Calculator B',
    client: clientB,
  });

  harnessA.outbox.enqueue({ kind: 'children', recordId: 'ID-1', payload: { id: 'ID-1', name: 'Ana' } });

  await harnessA.engine.syncNow();
  assert.equal(harnessA.outbox.countPending(), 0, 'coada lui A e goală după push');
  assert.equal(harnessA.engine.status().connection, 'online');

  await harnessB.engine.syncNow();
  const onB = harnessB.rawRecordRepository.find('children', 'ID-1');
  assert.ok(onB, 'înregistrarea lui A a ajuns pe B');
  assert.equal(onB.name, 'Ana');
  assert.equal(harnessB.engine.status().connection, 'online');
});

test('o modificare locală apărută în timpul unui push real către server nu se pierde (C-1)', async t => {
  const { origin } = await startRealServer(t);
  const branchId = 'branch-integrare-c1';

  const pairingClient = createSyncHttpClient({ serverUrl: origin, fetch: globalThis.fetch });
  const device = await pairingClient.pair({ setupKey: SETUP_KEY, name: 'Calculator A', os: 'Windows 11' });
  const realClient = createSyncHttpClient({ serverUrl: origin, token: device.token, fetch: globalThis.fetch });
  await realClient.registerBranch({
    id: branchId,
    name: 'Filiala principală',
    color: 'orange',
    address: '',
    createdAt: '2026-09-27T08:00:00.000Z',
  });

  // Clientul injectat în motor întârzie push-ul real (fetch spre serverul de pe port 0)
  // exact cât să putem simula o a doua salvare locală în fereastra „în zbor” — C-1.
  const pushGate = Promise.withResolvers();
  const delayedClient = {
    ...realClient,
    pushChanges: async (...args) => {
      await pushGate.promise;
      return realClient.pushChanges(...args);
    },
  };
  // Ceas determinist pentru outbox: a doua editare trebuie să aibă un „changedAt” sigur
  // mai nou, altfel politica last-writer-wins de pe server ar depinde de ceasul real (două
  // enqueue() sincrone pot cădea în aceeași milisecundă, un rezultat „superseded” la fel de
  // valid ca „applied”, dar care ar face testul aleatoriu).
  let outboxClockMs = Date.parse('2026-09-27T09:00:00.000Z');
  const harness = createDeviceHarness({
    branchId,
    deviceId: device.deviceId,
    deviceName: 'Calculator A',
    client: delayedClient,
    outboxNow: () => new Date((outboxClockMs += 1000)),
  });
  // „payments” e last-writer-wins (nu în CONFLICT_KINDS): fie a doua editare câștigă
  // (changedAt mai nou), fie serverul o declară „superseded” — caz în care motorul scrie
  // local capul serverului (applier.apply), deci payload-ul trebuie să fie o fișă validă
  // (normalizeRecord cere „date”), nu doar id+amount.
  harness.outbox.enqueue({
    kind: 'payments',
    recordId: 'PAY-1',
    payload: { id: 'PAY-1', amount: 100, date: '2026-09-27' },
  });

  const syncPromise = harness.engine.syncNow();
  harness.outbox.enqueue({
    kind: 'payments',
    recordId: 'PAY-1',
    payload: { id: 'PAY-1', amount: 150, date: '2026-09-27' },
  });
  pushGate.resolve();
  await syncPromise;

  assert.equal(harness.outbox.countPending(), 1, 'modificarea nouă a rămas pending, nu s-a pierdut la push-ul real');
  assert.deepEqual(harness.outbox.pending()[0].payload, { id: 'PAY-1', amount: 150, date: '2026-09-27' });

  // A doua sincronizare trimite ce a rămas în coadă; serverul îl aplică peste capul de la primul push (LWW).
  await harness.engine.syncNow();
  assert.equal(harness.outbox.countPending(), 0);

  const snapshot = await realClient.downloadSnapshot(branchId);
  assert.equal(snapshot.records.payments[0].payload.amount, 150);
});

test('S-1: după urcarea instantaneului, prima editare a unei fișe existente se aplică, nu produce conflict cu sine', async t => {
  const { origin } = await startRealServer(t);
  const branchId = 'branch-s1';

  const pairingClient = createSyncHttpClient({ serverUrl: origin, fetch: globalThis.fetch });
  const device = await pairingClient.pair({ setupKey: SETUP_KEY, name: 'Calculator A', os: 'Windows 11' });
  const client = createSyncHttpClient({ serverUrl: origin, token: device.token, fetch: globalThis.fetch });
  await client.registerBranch({
    id: branchId,
    name: 'Filiala principală',
    color: 'orange',
    address: '',
    createdAt: '2026-09-27T08:00:00.000Z',
  });

  // Reproducerea exactă a S-1 (connect() cu o filială nevidă — sync-connect.service.mjs
  // readLocalSnapshot + uploadSnapshot): fiecare rând urcat e scris pe server cu
  // updated_by = ACEST dispozitiv, la revizia 1.
  await client.uploadSnapshot(branchId, {
    entries: [
      {
        kind: 'children',
        id: 'CHILD-1',
        payload: { id: 'CHILD-1', name: 'Ana' },
        updatedAt: '2026-09-27T08:00:00.000Z',
      },
    ],
  });

  const harness = createDeviceHarness({ branchId, deviceId: device.deviceId, deviceName: 'Calculator A', client });
  // Rândul exista deja local înainte de connect (e chiar ce s-a urcat mai sus) — la fel ca
  // orice filială reală, nu doar pe server.
  harness.rawRecordRepository.save('children', { id: 'CHILD-1', name: 'Ana' });

  // Primul ciclu al motorului, imediat după connect (decizia din create-application.mjs):
  // outbox-ul e gol (nimic de urcat), pull-ul aduce înapoi propria schimbare din instantaneu.
  await harness.engine.syncNow();
  assert.equal(
    /** @type {{ serverRevision: number }} */ (harness.syncState.get('children', 'CHILD-1'))?.serverRevision,
    1,
    'S-1: sync_state trebuie scris și pentru schimbarea proprie întoarsă de pull (nu doar sărită)',
  );

  // Prima editare a fișei deja urcate — fără fix, enqueue() calculează baseRevision=0
  // (sync_state gol), serverul (revizia 1) o respinge ca „conflict”, cu autorul „Calculator A”.
  harness.outbox.enqueue({
    kind: 'children',
    recordId: 'CHILD-1',
    payload: { id: 'CHILD-1', name: 'Ana Popescu' },
  });
  await harness.engine.syncNow();

  assert.equal(harness.conflicts.count(), 0, 'editarea nu trebuie să producă un conflict cu sine');
  assert.equal(harness.outbox.countPending(), 0, 'editarea trebuie aplicată (applied), nu parcată');
  const snapshotAfterEdit = await client.downloadSnapshot(branchId);
  assert.equal(
    snapshotAfterEdit.records.children[0].payload.name,
    'Ana Popescu',
    'editarea a ajuns pe server, nu doar local',
  );
});
