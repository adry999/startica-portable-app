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
import { startTestApplication } from '#test-support/start-test-application.mjs';

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
  const result = await b.service.connect({
    serverUrl,
    code: undefined,
    setupKey: SETUP_KEY,
    deviceName: 'Calculator B',
  });

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
  // writeLocalSnapshot trece acum prin applySnapshotEntry (B-1, ca la 410) — normalizeRecord
  // adaugă implicitele fișei (status, dueDay...), deci verificăm câmpurile trimise, nu egalitate
  // strictă cu payload-ul minimal salvat de A mai sus.
  assert.equal(found?.id, 'CHILD-1');
  assert.equal(found?.name, 'Ana', 'datele urcate de A ajung în baza lui B');
});

// B-1/B-2 (audit 2026-09-29): connect() cu prezență/bazin deja pe „server" — dovadă că
// readLocalSnapshot le urcă (B-2) și writeLocalSnapshot nu mai aruncă la descărcare (B-1).
test('connect() reușește și transportă prezența/bazinul când filiala de pe server are deja istoric', async t => {
  const serverUrl = await startRealSyncServer(t);

  const a = harness(t, { name: 'Filiala principală', color: 'orange', address: '', folder: null });
  const dataDirA = join(a.home, 'data');
  const { openDatabase } = await import('#core/server/database/sqlite-connection.mjs');
  const openedA = openDatabase({ dataDir: dataDirA, backupDir: join(a.home, 'backups') });
  createRecordRepository(openedA.db).save('children', { id: 'CHILD-1', name: 'Ana' });
  openedA.db.exec(
    "INSERT INTO attendance(child_id,date,status,reason,updated_at) VALUES('CHILD-1','2026-09-10','present','','2026-09-10T07:30:00.000Z')",
  );
  openedA.db.exec(
    `INSERT INTO pool_bookings(id,child_id,coach_id,weekday,time,start_date,end_date,archived_at,updated_at)
     VALUES('BOOK-1','CHILD-1','COACH-1',1,'10:00','2026-09-01',NULL,NULL,'2026-09-01T09:00:00.000Z')`,
  );
  openedA.db.exec(
    "INSERT INTO pool_sessions(booking_id,date,status,updated_at) VALUES('BOOK-1','2026-09-15','scheduled','2026-09-15T09:00:00.000Z')",
  );
  openedA.db.exec("INSERT INTO pool_closings(month,closed_at) VALUES('2026-08','2026-09-01T00:00:00.000Z')");
  openedA.db.close();

  // Reproducerea exactă a B-1: dacă writeLocalSnapshot n-ar trece prin applySnapshotEntry,
  // downloadSnapshot-ul lui B ar arunca „Provided value cannot be bound to SQLite parameter 2”.
  await assert.doesNotReject(a.service.connect({ serverUrl, setupKey: SETUP_KEY, deviceName: 'Calculator A' }));

  const b = harness(t, { name: '', color: 'orange', address: '', folder: null }, 'b-local-1');
  const result = await b.service.connect({ serverUrl, setupKey: SETUP_KEY, deviceName: 'Calculator B' });

  assert.equal(result.downloaded.length, 1);

  const dirsAfter = join(b.home, 'data');
  const opened = openDatabaseReadOnly({ dataDir: dirsAfter });
  const db = /** @type {any} */ (opened).db;
  const attendanceRow = db.prepare('SELECT * FROM attendance WHERE child_id=? AND date=?').get('CHILD-1', '2026-09-10');
  const bookingRow = db.prepare('SELECT * FROM pool_bookings WHERE id=?').get('BOOK-1');
  const sessionRow = db
    .prepare('SELECT * FROM pool_sessions WHERE booking_id=? AND date=?')
    .get('BOOK-1', '2026-09-15');
  const closingRow = db.prepare('SELECT * FROM pool_closings WHERE month=?').get('2026-08');
  db.close();

  assert.equal(attendanceRow?.status, 'present', 'prezența lui A ajunge la B (B-2)');
  assert.equal(bookingRow?.child_id, 'CHILD-1', 'programarea de bazin ajunge la B (B-2)');
  assert.equal(sessionRow?.status, 'scheduled', 'ședința de bazin ajunge la B (B-2)');
  assert.equal(closingRow?.closed_at, '2026-09-01T00:00:00.000Z', 'închiderea de lună ajunge la B (B-2)');
});

// S-3 (audit final 2026-09-29): B-4 rezolva doar jumătate din „reconectare” — o filială
// nevidă care a mai sincronizat cu un server oarecare scapă de 409 (hasLocalSyncState), dar
// disconnect() șterge exact acel `sync_state`, deci reconectarea la ACELAȘI server rămânea
// 409 definitiv. Folosește aplicația completă (startTestApplication), nu harness-ul de mai
// sus — disconnect() e expus doar prin ruta reală (/api/sync/disconnect).
test('S-3: deconectarea urmată de reconectarea la ACELAȘI server reușește, nu mai dă 409 definitiv', async t => {
  const serverUrl = await startRealSyncServer(t);

  const a = await startTestApplication(t, { prefix: 'startica-s3-a-' });
  const saveChild = await a.post('/api/record', {
    type: 'children',
    mode: 'create',
    record: { id: 'CHILD-1', name: 'Ana' },
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(saveChild.status, 200, JSON.stringify(saveChild.body));

  const connect1 = await a.post('/api/sync/connect', { serverUrl, setupKey: SETUP_KEY, deviceName: 'Calculator A' });
  assert.equal(connect1.status, 200, JSON.stringify(connect1.body));

  const disconnect = await a.post('/api/sync/disconnect', {});
  assert.equal(disconnect.status, 200, JSON.stringify(disconnect.body));

  // Reproducerea S-3: reconectare la ACELAȘI serverUrl — filiala nu mai e goală local (n-a
  // fost ștearsă de disconnect), iar serverul o are deja înregistrată, cu date.
  const connect2 = await a.post('/api/sync/connect', { serverUrl, setupKey: SETUP_KEY, deviceName: 'Calculator A' });
  assert.equal(connect2.status, 200, JSON.stringify(connect2.body));

  const state = await a.get('/api/state');
  assert.ok(
    state.state.children.some(child => child.id === 'CHILD-1'),
    'fișa creată înainte de deconectare supraviețuiește reconectării (descărcată peste local, cu backup)',
  );
});

// Contra-proba S-3: un server DIFERIT trebuie să păstreze respingerea de azi (409) — doar
// ACELAȘI server (sync.last_server_url, scris la disconnect) e tratat ca „același
// calculator revenit”. `harness()` de mai sus nu poate fi refolosit — syncDevice-ul lui
// fals întoarce mereu `null` la read(), deci nu poate ține minte serverUrl-ul peste un
// disconnect() (stateless prin construcție, pentru testele care nu-l ating). Un syncDevice
// fals STATEFUL, local acestui test.
test('S-3: reconectarea la un server DIFERIT păstrează respingerea de azi (409) pentru o filială nevidă deja înregistrată acolo', async t => {
  const serverUrl1 = await startRealSyncServer(t);
  const serverUrl2 = await startRealSyncServer(t);
  const { openDatabase } = await import('#core/server/database/sqlite-connection.mjs');

  const home = mkdtempSync(join(tmpdir(), 'sync-connect-s3-diff-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const registry = createBranchRegistryStore({ file: join(home, 'filiale.json'), createId: () => 'local-1' });
  registry.ensure(/** @type {any} */ ({ name: 'Filiala principală', color: 'orange', address: '', folder: null }));
  /** @type {any} */
  let device = null;
  const service = createSyncConnectService({
    registry,
    home,
    legacy: { dataDir: join(home, 'data'), backupDir: join(home, 'backups') },
    syncDevice: {
      read: () => device,
      write: d => {
        device = d;
      },
      clear: () => {
        device = null;
      },
    },
    deleteSyncDeviceFile: () => {},
    createHttpClient: options => createSyncHttpClient({ ...options, fetch: globalThis.fetch }),
    now: () => new Date('2026-09-28T12:00:00.000Z'),
    platform: () => 'Windows 11',
    reopenActiveBranch: () => {},
  });
  const opened = openDatabase({ dataDir: join(home, 'data'), backupDir: join(home, 'backups') });
  createRecordRepository(opened.db).save('children', { id: 'CHILD-1', name: 'Ana' });
  opened.db.close();

  await service.connect({ serverUrl: serverUrl1, setupKey: SETUP_KEY, deviceName: 'Calculator A' });
  service.disconnect();

  // Un „impostor” cu filiale.json copiat (același id de filială, aceleași date) e deja
  // conectat pe serverul 2, ÎNAINTE ca A să încerce vreodată acel server.
  const impostorHome = mkdtempSync(join(tmpdir(), 'sync-connect-s3-diff-impostor-'));
  t.after(() => rmSync(impostorHome, { recursive: true, force: true }));
  const impostorRegistry = createBranchRegistryStore({
    file: join(impostorHome, 'filiale.json'),
    createId: () => 'local-1',
  });
  impostorRegistry.ensure(
    /** @type {any} */ ({ name: 'Filiala principală', color: 'orange', address: '', folder: null }),
  );
  const impostorService = createSyncConnectService({
    registry: impostorRegistry,
    home: impostorHome,
    legacy: { dataDir: join(impostorHome, 'data'), backupDir: join(impostorHome, 'backups') },
    syncDevice: { read: () => null, write: () => {}, clear: () => {} },
    deleteSyncDeviceFile: () => {},
    createHttpClient: options => createSyncHttpClient({ ...options, fetch: globalThis.fetch }),
    now: () => new Date('2026-09-28T12:00:00.000Z'),
    platform: () => 'Windows 11',
    reopenActiveBranch: () => {},
  });
  const impostorOpened = openDatabase({
    dataDir: join(impostorHome, 'data'),
    backupDir: join(impostorHome, 'backups'),
  });
  createRecordRepository(impostorOpened.db).save('children', { id: 'CHILD-1', name: 'Ana' });
  impostorOpened.db.close();
  await impostorService.connect({ serverUrl: serverUrl2, setupKey: SETUP_KEY, deviceName: 'Calculator impostor' });

  // A (deconectat de pe serverul 1) încearcă serverul 2 — last_server_url ține minte
  // serverul 1, nu al doilea, deci NU trebuie recunoscut ca „același calculator revenit”.
  await assert.rejects(
    () => service.connect({ serverUrl: serverUrl2, setupKey: SETUP_KEY, deviceName: 'Calculator A' }),
    /există deja pe server/,
  );
});

// S-5 (audit final 2026-09-29): adoptarea unei filiale goale (registry.replaceEmpty) îi
// schimbă id-ul, dar nimic nu rescria staff.branchIds/salary_payments.branchId din setul
// comun — un angajat creat pe filiala implicită ÎNAINTE de „Conectează” (Personal se poate
// folosi imediat, chiar dacă filiala încă nu are copii/grupe) rămânea orfan: id-ul vechi nu
// mai exista în niciun registru, angajatul dispărea din lista filialei pe ambele calculatoare.
// Aplicația completă (nu harness-ul de mai sus) — are nevoie de contextul comun cablat
// (create-application.mjs), pe care createSyncConnectService al harness-ului nu-l dă.
test('S-5: adoptarea unei filiale goale remapează staff.branchIds la noul id al filialei', async t => {
  const serverUrl = await startRealSyncServer(t);

  // A: filială cu date (un copil) — urcată normal, id-ul ei nu se schimbă.
  const a = await startTestApplication(t, { prefix: 'startica-s5-a-' });
  const saveChild = await a.post('/api/record', {
    type: 'children',
    mode: 'create',
    record: { id: 'CHILD-1', name: 'Ana' },
    revision: 0,
    requestId: randomUUID(),
  });
  assert.equal(saveChild.status, 200, JSON.stringify(saveChild.body));
  const connectA = await a.post('/api/sync/connect', { serverUrl, setupKey: SETUP_KEY, deviceName: 'Calculator A' });
  assert.equal(connectA.status, 200, JSON.stringify(connectA.body));

  // B: instalare nouă — filiala implicită e GOALĂ (fără copii/grupe, singurul criteriu al
  // lui isBranchEmpty), dar un angajat se poate crea pe ea oricând, înainte de „Conectează”.
  const b = await startTestApplication(t, { prefix: 'startica-s5-b-' });
  const oldBranchId = (await b.get('/api/session')).branch.id;
  const staffResult = await b.post('/api/personal/staff', {
    mode: 'create',
    staff: {
      id: 'STF-1',
      name: 'Angajata lui B',
      roleId: 'ROL-educator',
      branchIds: [oldBranchId],
      since: '2026-01-01',
    },
  });
  assert.equal(staffResult.status, 200, JSON.stringify(staffResult.body));

  // Connect — filiala goală a lui B adoptă filiala lui A (singura de pe server) în locul ei.
  const connectB = await b.post('/api/sync/connect', { serverUrl, setupKey: SETUP_KEY, deviceName: 'Calculator B' });
  assert.equal(connectB.status, 200, JSON.stringify(connectB.body));
  assert.equal(connectB.body.downloaded.length, 1, 'B a adoptat filiala lui A');
  const newBranchId = connectB.body.downloaded[0].id;
  assert.notEqual(newBranchId, oldBranchId, 'id-ul filialei s-a schimbat la adoptare');

  const stateB = await b.get('/api/personal/state');
  const staff = stateB.staff.find(s => s.id === 'STF-1');
  assert.ok(staff, 'angajata lui B supraviețuiește adoptării și apare în echipa filialei active (S-5)');
  assert.deepEqual(
    staff.branchIds,
    [newBranchId],
    'branchIds a fost remapat de la vechiul id (dispărut din registru) la noul id al filialei',
  );
});
