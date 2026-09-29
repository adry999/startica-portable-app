import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestApplication, createApplication } from '#test-support/start-test-application.mjs';
import { createSyncServer } from '#sync-server/create-sync-server.mjs';
import { openDatabase } from '#core/server/database/sqlite-connection.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createKindRepository } from '#core/server/persistence/kind-repository.mjs';
import { commonDirectories } from '#core/server/branches/branch-layout.mjs';

/** @param {string} home */
function staffIdsInCommonDataset(home) {
  const { dataDir, backupDir } = commonDirectories(home);
  const opened = openDatabase({ dataDir, backupDir });
  try {
    return createKindRepository(opened.db)
      .list('staff')
      .map(staff => staff.id)
      .sort();
  } finally {
    opened.db.close();
  }
}

const SETUP_KEY = 'cheie-dev-comun';

/** @param {import('node:test').TestContext} t */
async function startRealSyncServer(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'sync-server-comun-integration-'));
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

/** @param {string} branchId @param {Partial<{ id: string, name: string, roleId: string, branchIds: string[], since: string }>} [overrides] */
const staffInput = (branchId, overrides = {}) => ({
  id: 'STF-1',
  name: 'Ana Popescu',
  roleId: 'ROL-educator',
  branchIds: [branchId],
  since: '2026-01-01',
  ...overrides,
});

test('setul comun se urcă de pe primul calculator și se contopește de pe al doilea fără 409', async t => {
  const serverUrl = await startRealSyncServer(t);

  const a = await startTestApplication(t, { prefix: 'startica-comun-a-' });
  const branchA = (await a.get('/api/session')).branch.id;
  const b = await startTestApplication(t, { prefix: 'startica-comun-b-' });
  const branchB = (await b.get('/api/session')).branch.id;

  let response = await a.post('/api/personal/staff', {
    mode: 'create',
    staff: staffInput(branchA, { id: 'STF-A', name: 'Angajata lui A' }),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));

  const connectA = await a.post('/api/sync/connect', {
    serverUrl,
    setupKey: SETUP_KEY,
    deviceName: 'Calculator A',
  });
  assert.equal(connectA.status, 200, JSON.stringify(connectA.body));

  response = await b.post('/api/personal/staff', {
    mode: 'create',
    staff: staffInput(branchB, { id: 'STF-B', name: 'Angajatul lui B' }),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));

  // Filiala lui B trebuie să aibă deja o evidență (nu doar personal) înainte de connect —
  // altfel reconcilierea de filiale (sync-connect.service.mjs) o consideră „goală" și o
  // adoptă drept o a doua filială locală (folder nou, date descărcate) — nu schimbă id-ul
  // filialei ei active, dar ar schimba scenariul testat aici fără rost.
  const opened = openDatabase({ dataDir: join(b.dir, 'data'), backupDir: join(b.dir, 'backups') });
  createRecordRepository(opened.db).save('children', { id: 'CHILD-B', name: 'Copilul lui B' });
  opened.db.close();

  // Punctul verificat de acest test (decizia 9, „Changes to the sync plan”): al doilea
  // calculator are deja rânduri în „comun” (angajatul lui B, semințele proprii) — connect()
  // nu are voie să dea 409 ca pentru o filială, ci să urce rândurile lui ca modificări
  // obișnuite (baseRevision 0).
  const connectB = await b.post('/api/sync/connect', {
    serverUrl,
    setupKey: SETUP_KEY,
    deviceName: 'Calculator B',
  });
  assert.equal(connectB.status, 200, JSON.stringify(connectB.body));

  // syncNow() e sincron din perspectiva răspunsului HTTP (motorul.syncNow() e așteptat) —
  // nu depindem de polling-ul de 15s al motorului.
  await a.post('/api/sync/now', {});
  await b.post('/api/sync/now', {});
  await a.post('/api/sync/now', {});

  // Verificare la nivelul setului comun, nu prin „/api/personal/state" — acela filtrează
  // pe filiala activă (decizia 1, 24-personal.md, deja acoperit de personal.routes.
  // integration.test.mjs), un comportament separat de contopirea testată aici.
  assert.deepEqual(
    staffIdsInCommonDataset(a.dir),
    ['STF-A', 'STF-B'],
    'baza „comun" a lui A conține propriul angajat și pe al lui B, după contopire',
  );
  assert.deepEqual(
    staffIdsInCommonDataset(b.dir),
    ['STF-A', 'STF-B'],
    'baza „comun" a lui B conține propriul angajat și pe al lui A, după contopire',
  );
});

test('motorul setului comun rulează în paralel cu cel al filialei și supraviețuiește schimbării filialei', async t => {
  const home = mkdtempSync(join(tmpdir(), 'sync-comun-engine-switch-'));

  // Adresă https validă, dar de nefolosit: verificăm doar pornirea/oprirea celor două
  // motoare (filială + comun), nu o sincronizare reală — un fetch fals „offline” evită
  // orice cerere de rețea reală (același tipar ca sync.routes.integration.test.mjs).
  const offlineFetch = async () => {
    throw new Error('rețea indisponibilă în test');
  };
  const bootstrap = createApplication({
    home,
    dataDir: join(home, 'data'),
    backupDir: join(home, 'backups'),
    autoBackupIntervalMs: 0,
    fetch: offlineFetch,
  });
  await new Promise(resolve => bootstrap.server.listen(0, '127.0.0.1', resolve));
  writeFileSync(
    join(home, 'sync.json'),
    JSON.stringify({
      version: 1,
      serverUrl: 'https://sync.exemplu-test.invalid',
      deviceId: 'dev-test',
      deviceName: 'Calculator A',
      token: 'tok',
      connectedAt: new Date().toISOString(),
    }),
  );
  await bootstrap.close();

  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let started = 0;
  let cleared = 0;
  globalThis.setInterval = /** @type {any} */ (
    (...args) => {
      started += 1;
      return originalSetInterval(...args);
    }
  );
  globalThis.clearInterval = /** @type {any} */ (
    (...args) => {
      cleared += 1;
      return originalClearInterval(...args);
    }
  );
  t.after(() => {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  });

  const app = createApplication({
    home,
    dataDir: join(home, 'data'),
    backupDir: join(home, 'backups'),
    autoBackupIntervalMs: 0,
    fetch: offlineFetch,
  });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await app.close();
    rmSync(home, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (app.server.address()).port}`;
  const token = (await (await fetch(origin + '/api/session')).json()).token;

  app.startSync();
  // 2: motorul filialei active și cel al setului comun pornesc câte un timer de polling,
  // fiecare la primul startSync() al procesului (decizia 9).
  assert.equal(started, 2, 'ambele motoare (filială + comun) au pornit câte un timer de polling');

  const secondBranch = app.registry.add({ name: 'Filiala a doua', color: 'orange', address: '' });
  const select = await fetch(origin + '/api/branches/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
    body: JSON.stringify({ id: secondBranch.id }),
  });
  assert.equal(select.status, 200);
  // Comutarea e amânată cu un tick (create-application.mjs) — dăm timp motorului vechi
  // al filialei să se oprească și celui nou să pornească înainte de a verifica.
  await new Promise(resolve => setTimeout(resolve, 150));

  // Exact 1, nu 2: doar motorul VECHI al filialei s-a oprit — cel al setului comun nu a
  // fost niciodată atins de schimbarea filialei (decizia 9, spre deosebire de motorul
  // unei filiale, care se reconstruiește la fiecare schimbare).
  assert.equal(cleared, 1, 'doar motorul vechi al filialei s-a oprit, nu și cel al setului comun');
  // Exact 3 (2 inițiale + motorul NOU al filialei): motorul setului comun nu a pornit
  // din nou — a rămas cel deschis la app.startSync().
  assert.equal(started, 3, 'doar filiala nouă a pornit un motor nou; cel al setului comun a supraviețuit');

  const status = await (await fetch(origin + '/api/sync/status')).json();
  assert.equal(status.configured, true, 'filiala nouă vede același sync.json');
});

test('o modificare de personal făcută dincolo reîncarcă echipa aici', async t => {
  const serverUrl = await startRealSyncServer(t);

  const a = await startTestApplication(t, { prefix: 'startica-comun-reload-a-' });
  const connectA = await a.post('/api/sync/connect', { serverUrl, setupKey: SETUP_KEY, deviceName: 'Calculator A' });
  assert.equal(connectA.status, 200, JSON.stringify(connectA.body));

  const b = await startTestApplication(t, { prefix: 'startica-comun-reload-b-' });
  const connectB = await b.post('/api/sync/connect', { serverUrl, setupKey: SETUP_KEY, deviceName: 'Calculator B' });
  assert.equal(connectB.status, 200, JSON.stringify(connectB.body));
  // Filiala lui B era goală — connect() a adoptat filiala lui A în locul ei (reconciliere de
  // filiale, sync-connect.service.mjs), deci id-ul de dinainte de connect nu mai există.
  const branchB = (await b.get('/api/session')).branch.id;

  // Ascultă /api/sync/events pe A ÎNAINTE ca B să scrie — evenimentul local e cel prin
  // care usePersonal() din webapp ar reîncărca echipa (useSyncStatus.ts, dataset: 'comun').
  const eventsResponse = await fetch(a.origin + '/api/sync/events');
  assert.equal(eventsResponse.status, 200);
  const reader = /** @type {ReadableStream} */ (eventsResponse.body).getReader();
  /** @type {{ event: string, data: any }[]} */
  const received = [];
  let buffer = '';
  const collect = (async () => {
    while (!received.some(entry => entry.event === 'records-changed' && entry.data?.dataset === 'comun')) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += Buffer.from(value).toString('utf8');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const eventLine = rawEvent.split('\n').find(line => line.startsWith('event:'));
        const dataLine = rawEvent.split('\n').find(line => line.startsWith('data:'));
        if (eventLine)
          received.push({
            event: eventLine.slice(6).trim(),
            data: dataLine ? JSON.parse(dataLine.slice(5).trim()) : undefined,
          });
      }
    }
  })();

  // „Dincolo” = calculatorul B: un angajat nou, apoi urcat pe server.
  const response = await b.post('/api/personal/staff', {
    mode: 'create',
    staff: staffInput(branchB, { id: 'STF-DINCOLO', name: 'Angajată nouă' }),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  await b.post('/api/sync/now', {});

  // Pull-ul lui A — engine-ul setului comun aplică modificarea și anunță SSE-ul local.
  await a.post('/api/sync/now', {});

  await Promise.race([
    collect,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout așteptând records-changed(comun)')), 5000)),
  ]);
  await reader.cancel();

  const commonRecordsChanged = received.find(
    entry => entry.event === 'records-changed' && entry.data?.dataset === 'comun',
  );
  assert.ok(commonRecordsChanged, 'a ajuns un records-changed cu dataset: comun — usePersonal() ar reîncărca echipa');

  const stateA = await a.get('/api/personal/state');
  assert.ok(
    stateA.staff.some(staff => staff.id === 'STF-DINCOLO'),
    'angajatul adăugat pe B ajunge în echipa lui A, prin motorul setului comun',
  );
});
