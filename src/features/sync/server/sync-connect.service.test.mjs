import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBranchRegistryStore } from '#core/server/branches/branch-registry.mjs';
import { openDatabase } from '#core/server/database/sqlite-connection.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createSyncStateRepository } from './sync-state.repository.mjs';
import { createSyncConflictsRepository } from './sync-conflicts.repository.mjs';
import { createSyncOutboxRepository } from './sync-outbox.repository.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import { createSyncConnectService } from './sync-connect.service.mjs';

const NOW = () => new Date('2026-09-29T10:00:00.000Z');

/**
 * B-4/B-9: client HTTP fals, ca sync-engine.service.test.mjs (`fakeClient`) — evită un
 * sync-server real, pentru scenarii pe care doar controlul exact al răspunsurilor le poate
 * reproduce determinist (o conectare întreruptă exact între `registerBranch` și
 * `uploadSnapshot`, o revocare care trebuie apelată exact o dată).
 * @param {Partial<Record<string, Function>>} overrides
 */
function fakeClient(overrides = {}) {
  const calls = { revokeDevice: /** @type {string[]} */ ([]), registerBranch: 0, uploadSnapshot: 0 };
  const client = {
    pair: async () => ({ deviceId: 'dev-1', token: 'tok-1' }),
    status: async () => ({ connection: 'online' }),
    createPairingCode: async () => ({ code: '000000', expiresAt: '', serverUrl: '' }),
    listDevices: async () => ({ devices: [] }),
    listBranches: async () => ({ branches: [] }),
    registerBranch: async () => {
      calls.registerBranch += 1;
    },
    uploadSnapshot: async () => {
      calls.uploadSnapshot += 1;
    },
    downloadSnapshot: async () => ({ records: {}, headSeq: 0 }),
    pushChanges: async () => ({ results: [] }),
    pullChanges: async () => ({ changes: [], nextSince: 0, headSeq: 0 }),
    revokeDevice: async deviceId => {
      calls.revokeDevice.push(deviceId);
    },
    openEvents: () => ({ close: () => {} }),
    ...overrides,
  };
  return { client, calls };
}

/**
 * @param {import('node:test').TestContext} t
 * @param {{ client: ReturnType<typeof fakeClient>['client'] }} deps
 * @param {{ name: string, color?: string, address?: string, folder?: string | null }} [initial]
 */
function harness(t, { client }, initial = { name: 'Filiala principală', color: 'orange', address: '', folder: null }) {
  const home = mkdtempSync(join(tmpdir(), 'sync-connect-unit-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const registry = createBranchRegistryStore({ file: join(home, 'filiale.json'), createId: () => 'local-1' });
  registry.ensure(/** @type {any} */ (initial));
  const legacy = { dataDir: join(home, 'data'), backupDir: join(home, 'backups') };
  /** @type {any[]} */
  const deviceWrites = [];
  let deviceCleared = false;
  let reopenCalls = 0;
  const service = createSyncConnectService({
    registry,
    home,
    legacy,
    syncDevice: {
      read: () => null,
      write: device => deviceWrites.push(device),
      clear: () => {
        deviceCleared = true;
      },
    },
    deleteSyncDeviceFile: () => {},
    createHttpClient: () => client,
    now: NOW,
    platform: () => 'Windows 11',
    reopenActiveBranch: () => {
      reopenCalls += 1;
    },
  });
  return {
    home,
    legacy,
    registry,
    service,
    deviceWrites,
    reopenCalls: () => reopenCalls,
    deviceCleared: () => deviceCleared,
  };
}

/** Scrie o înregistrare directă, ca filiala să nu mai fie „goală”. */
function seedBranchData(legacy) {
  const opened = openDatabase(legacy);
  createRecordRepository(opened.db).save('children', { id: 'CHILD-1', name: 'Ana' });
  opened.db.close();
}

test('B-9: un connect eșuat după pair() revocă dispozitivul înregistrat, ca reîncercarea să nu rămână blocată', async t => {
  const { client, calls } = fakeClient({
    uploadSnapshot: async () => {
      throw new Error('rețea căzută la încărcare');
    },
  });
  const h = harness(t, { client });
  seedBranchData(h.legacy);

  await assert.rejects(
    () => h.service.connect({ serverUrl: 'https://server.test', code: 'ABC', deviceName: 'Calculator A' }),
    /rețea căzută/,
  );

  assert.deepEqual(calls.revokeDevice, ['dev-1'], 'dispozitivul tocmai înregistrat a fost revocat');
  assert.equal(h.deviceWrites.length, 0, 'sync.json nu a fost scris — connect() a eșuat');
});

test('B-9: dacă revocarea eșuează la rândul ei, eroarea originală tot ajunge la utilizator', async t => {
  const { client } = fakeClient({
    uploadSnapshot: async () => {
      throw new Error('rețea căzută la încărcare');
    },
    revokeDevice: async () => {
      throw new Error('serverul a picat chiar acum');
    },
  });
  const h = harness(t, { client });
  seedBranchData(h.legacy);

  await assert.rejects(
    () => h.service.connect({ serverUrl: 'https://server.test', code: 'ABC', deviceName: 'Calculator A' }),
    /rețea căzută/,
    'nu eroarea de revocare, ci cauza inițială',
  );
});

test('B-4: o filială înregistrată dar fără instantaneu pe server (headSeq 0) reia încărcarea, nu 409', async t => {
  const { client, calls } = fakeClient({
    listBranches: async () => ({
      branches: [
        { id: 'local-1', name: 'Filiala principală', color: 'orange', address: '', createdAt: NOW().toISOString() },
      ],
    }),
    downloadSnapshot: async () => ({ records: {}, headSeq: 0 }),
  });
  const h = harness(t, { client });
  seedBranchData(h.legacy);

  const result = await h.service.connect({ serverUrl: 'https://server.test', code: 'ABC', deviceName: 'Calculator A' });

  assert.deepEqual(result.uploaded, [{ id: 'local-1', name: 'Filiala principală' }]);
  assert.equal(calls.registerBranch, 1, 'reia înregistrarea (idempotentă pe server)');
  assert.equal(calls.uploadSnapshot, 1, 'reia încărcarea, în loc să respingă cu 409');
  assert.equal(h.deviceWrites.length, 1, 'de data asta connect() reușește complet');
});

test('B-4: o filială cu sync_state local nevid nu e tratată ca filiale.json copiat la reconectare', async t => {
  const { client, calls } = fakeClient({
    listBranches: async () => ({
      branches: [
        { id: 'local-1', name: 'Filiala principală', color: 'orange', address: '', createdAt: NOW().toISOString() },
      ],
    }),
    downloadSnapshot: async () => {
      throw new Error('downloadSnapshot nu era așteptat — sync_state local ar fi trebuit să scurtcircuiteze');
    },
  });
  const h = harness(t, { client });
  seedBranchData(h.legacy);
  // Simulează o filială care a mai sincronizat cândva (sync.json pierdut/corupt, dar
  // baza locală păstrează sync_state din sesiunea de sincronizare anterioară).
  const opened = openDatabase(h.legacy);
  createSyncStateRepository(opened.db).set('children', 'CHILD-1', {
    serverRevision: 3,
    updatedAt: NOW().toISOString(),
    updatedByDevice: 'dev-old',
  });
  opened.db.close();

  const result = await h.service.connect({ serverUrl: 'https://server.test', code: 'ABC', deviceName: 'Calculator A' });

  assert.deepEqual(result.uploaded, [], 'nu re-urcă');
  assert.deepEqual(result.downloaded, [], 'nu descarcă — tratată ca același calculator revenit');
  assert.equal(calls.registerBranch, 0);
  assert.equal(calls.uploadSnapshot, 0);
  assert.equal(h.deviceWrites.length, 1, 'connect() reușește oricum (sync.json rescris)');
});

test('B-4: disconnect() golește sync_state/sync_conflicts/sync.since și arhivează outbox-ul', async t => {
  const { client } = fakeClient();
  const h = harness(t, { client });
  seedBranchData(h.legacy);

  const opened = openDatabase(h.legacy);
  createSyncStateRepository(opened.db).set('children', 'CHILD-1', {
    serverRevision: 3,
    updatedAt: NOW().toISOString(),
    updatedByDevice: 'dev-old',
  });
  createSyncConflictsRepository(opened.db, { now: NOW }).insert({
    kind: 'children',
    recordId: 'CHILD-1',
    localPayload: { id: 'CHILD-1', name: 'Ana' },
    localUpdatedAt: NOW().toISOString(),
    remotePayload: { id: 'CHILD-1', name: 'Ana B' },
    remoteRevision: 4,
    remoteUpdatedAt: NOW().toISOString(),
    remoteDeviceId: 'dev-old',
    remoteDeviceName: 'Calculator B',
    outboxSeq: null,
  });
  createSettingsRepository(opened.db).setSetting('sync.since', '7');
  const outbox = createSyncOutboxRepository(opened.db, { now: NOW });
  outbox.enqueue({ kind: 'children', recordId: 'CHILD-1', payload: { id: 'CHILD-1', name: 'Ana locală' } });
  opened.db.close();

  await h.service.disconnect();

  const reopened = openDatabase(h.legacy);
  /** @type {(sql: string) => number} */
  const countOf = sql => /** @type {{ n: number }} */ (reopened.db.prepare(sql).get()).n;
  assert.equal(countOf('SELECT COUNT(*) AS n FROM sync_state'), 0, 'sync_state golit');
  assert.equal(countOf('SELECT COUNT(*) AS n FROM sync_conflicts'), 0, 'sync_conflicts golit');
  assert.equal(
    reopened.db.prepare("SELECT value FROM settings WHERE key='sync.since'").get(),
    undefined,
    'sync.since șters',
  );
  const outboxRows = /** @type {{ status: string }[]} */ (reopened.db.prepare('SELECT status FROM sync_outbox').all());
  assert.deepEqual(
    outboxRows.map(row => row.status),
    ['archived'],
    'rândul pending e arhivat, nu șters și nu lăsat pending',
  );
  reopened.db.close();

  assert.ok(h.deviceCleared(), 'sync.json local a fost golit');
  assert.equal(h.reopenCalls(), 1);
});

test('B-4: după un disconnect() curat, reconectarea la un server nou pornește fără cursoare vechi', async t => {
  const { client: clientA } = fakeClient({
    listBranches: async () => ({ branches: [] }),
  });
  const h = harness(t, { client: clientA });
  seedBranchData(h.legacy);

  await h.service.connect({ serverUrl: 'https://server-a.test', code: 'ABC', deviceName: 'Calculator A' });
  assert.equal(h.deviceWrites.length, 1);

  await h.service.disconnect();

  // Reconectare la un server DIFERIT — filiala nu există acolo încă (branches: []), deci
  // trebuie tratată ca o urcare obișnuită, nu ca ceva contaminat de starea vechiului server.
  const serviceB = createSyncConnectService({
    registry: h.registry,
    home: h.home,
    legacy: h.legacy,
    syncDevice: { read: () => null, write: () => {}, clear: () => {} },
    deleteSyncDeviceFile: () => {},
    createHttpClient: () => fakeClient({ listBranches: async () => ({ branches: [] }) }).client,
    now: NOW,
    platform: () => 'Windows 11',
    reopenActiveBranch: () => {},
  });
  const result = await serviceB.connect({
    serverUrl: 'https://server-b.test',
    code: 'XYZ',
    deviceName: 'Calculator A',
  });
  assert.deepEqual(result.uploaded, [{ id: 'local-1', name: 'Filiala principală' }]);
});
