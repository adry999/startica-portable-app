import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createSyncServer } from '#sync-server/create-sync-server.mjs';
import { createSyncHttpClient } from './sync-http-client.mjs';
import { createBranchRegistryStore } from '#core/server/branches/branch-registry.mjs';
import { createSyncConnectService } from './sync-connect.service.mjs';
import { openDatabaseReadOnly } from '#core/server/database/sqlite-connection.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';

const SETUP_KEY = 'cheie-dev-connect';

/** @param {import('node:test').TestContext} t */
async function startRealSyncServer(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'sync-connect-server-'));
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
  t.after(async () => {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  });
  return `http://127.0.0.1:${port}`;
}

/** @param {import('node:test').TestContext} t @param {{ name: string, color?: string, address?: string, folder?: string | null }} [initial] @param {string} [forcedId] */
function harness(t, initial = { name: 'Filiala principală', color: 'orange', address: '', folder: null }, forcedId) {
  const home = mkdtempSync(join(tmpdir(), 'sync-connect-app-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  let counter = 0;
  const registry = createBranchRegistryStore({
    file: join(home, 'filiale.json'),
    createId: () => forcedId ?? `local-${++counter}`,
  });
  registry.ensure(/** @type {any} */ (initial));
  /** @type {any[]} */
  const deviceWrites = [];
  let reopenCalls = 0;
  const service = createSyncConnectService({
    registry,
    home,
    legacy: { dataDir: join(home, 'data'), backupDir: join(home, 'backups') },
    syncDevice: { read: () => null, write: device => deviceWrites.push(device), clear: () => {} },
    deleteSyncDeviceFile: () => {},
    createHttpClient: options => createSyncHttpClient({ ...options, fetch: globalThis.fetch }),
    now: () => new Date('2026-09-28T12:00:00.000Z'),
    platform: () => 'Windows 11',
    reopenActiveBranch: () => {
      reopenCalls += 1;
    },
  });
  return { home, registry, service, deviceWrites, reopenCalls: () => reopenCalls };
}

test('primul calculator urcă fiecare filială cu date o singură dată; un al doilea connect e refuzat cu 409', async t => {
  const serverUrl = await startRealSyncServer(t);
  const { registry, service, home, deviceWrites, reopenCalls } = harness(t);
  const branch = registry.list()[0];

  // Scrie o înregistrare direct în baza filialei, ca ea să nu mai fie „goală".
  const dataDir = join(home, 'data');
  const { openDatabase } = await import('#core/server/database/sqlite-connection.mjs');
  const opened = openDatabase({ dataDir, backupDir: join(home, 'backups') });
  createRecordRepository(opened.db).save('children', { id: 'CHILD-1', name: 'Ana' });
  opened.db.close();

  const result = await service.connect({ serverUrl, setupKey: SETUP_KEY, deviceName: 'Calculator A' });

  assert.deepEqual(result.uploaded, [{ id: branch.id, name: branch.name }]);
  assert.deepEqual(result.downloaded, []);
  assert.equal(deviceWrites.length, 1, 'sync.json a fost scris o dată');
  assert.equal(reopenCalls(), 1, 'contextul activ a fost recreat după connect');

  // Un al doilea calculator cu filiale.json COPIAT (același id de filială, cu date
  // locale la fel) trebuie refuzat — serverul are deja date pentru acel id.
  const second = harness(
    t,
    { name: branch.name, color: branch.color, address: branch.address, folder: null },
    branch.id,
  );
  const openedSecond = (await import('#core/server/database/sqlite-connection.mjs')).openDatabase({
    dataDir: join(second.home, 'data'),
    backupDir: join(second.home, 'backups'),
  });
  createRecordRepository(openedSecond.db).save('children', { id: 'CHILD-1', name: 'Ana' });
  openedSecond.db.close();

  await assert.rejects(
    () => second.service.connect({ serverUrl, setupKey: SETUP_KEY, deviceName: 'Calculator B' }),
    /există deja pe server/,
  );
});

test('un calculator nou cu filiala goală preia prima filială de pe server în locul ei și o descarcă', async t => {
  const serverUrl = await startRealSyncServer(t);

  // Calculatorul A: filială cu date, urcată.
  const a = harness(t, { name: 'Filiala principală', color: 'orange', address: '', folder: null });
  const dataDirA = join(a.home, 'data');
  const { openDatabase } = await import('#core/server/database/sqlite-connection.mjs');
  const openedA = openDatabase({ dataDir: dataDirA, backupDir: join(a.home, 'backups') });
  createRecordRepository(openedA.db).save('children', { id: 'CHILD-1', name: 'Ana' });
  openedA.db.close();
  const branchA = a.registry.list()[0];
  await a.service.connect({ serverUrl, setupKey: SETUP_KEY, deviceName: 'Calculator A' });

  // Calculatorul B: instalare nouă, filială #1 goală, cu id LOCAL propriu (distinct
  // de al lui A — pe un calculator adevărat, randomUUID() nu ar coincide niciodată) —
  // trebuie să adopte filiala lui A, nu să o confunde cu a lui proprie.
  const b = harness(t, { name: '', color: 'orange', address: '', folder: null }, 'b-local-1');
  const localEmptyId = b.registry.list()[0].id;
  const result = await b.service.connect({ serverUrl, code: undefined, setupKey: SETUP_KEY, deviceName: 'Calculator B' });

  assert.deepEqual(result.uploaded, []);
  assert.equal(result.downloaded.length, 1);
  assert.equal(result.downloaded[0].id, branchA.id);

  const replaced = b.registry.find(branchA.id);
  assert.ok(replaced, 'filiala goală a fost înlocuită cu id-ul celei de pe server');
  assert.equal(b.registry.find(localEmptyId), undefined, 'vechiul id local a dispărut');

  const dirsAfter = join(b.home, 'data');
  const opened = openDatabaseReadOnly({ dataDir: dirsAfter });
  const found = createRecordRepository(/** @type {any} */ (opened).db).find('children', 'CHILD-1');
  /** @type {any} */ (opened).db.close();
  assert.deepEqual(found, { id: 'CHILD-1', name: 'Ana' }, 'datele urcate de A ajung în baza lui B');
});
