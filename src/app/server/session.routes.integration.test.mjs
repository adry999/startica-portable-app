import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createApplication, startTestApplication, removeDirWithRetry } from '#test-support/start-test-application.mjs';

test('/api/session întoarce un token de sesiune', async t => {
  const app = await startTestApplication(t, { prefix: 'startica-session-' });
  assert.ok(app.token && app.token.length > 0);
});

test('/api/session întoarce versiunea din package.json', async t => {
  const app = await startTestApplication(t, { prefix: 'startica-session-' });
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal((await app.get('/api/session')).version, version);
});

// §5.2: /api/session nu face nicio cerere de rețea la citire — update rămâne „nicio
// verificare încă” până la un app.checkForUpdate() explicit (main.mjs, pornire + 6 ore).
test('/api/session: fără checkForUpdate(), update arată „nicio verificare încă”, fără rețea', async t => {
  let fetchCalls = 0;
  const fetch = async () => {
    fetchCalls++;
    throw new Error('fetch nu ar trebui chemat');
  };
  const app = await startTestApplication(t, { prefix: 'startica-session-update-', fetch });
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

  const session = await app.get('/api/session');

  assert.deepEqual(session.update, {
    updateAvailable: false,
    currentVersion: version,
    latestVersion: version,
    releaseUrl: null,
    downloadUrl: null,
    sha256: null,
    notes: null,
    checkedAt: null,
    error: null,
  });
  assert.equal(fetchCalls, 0);
});

test('/api/session: după app.checkForUpdate(), update reflectă manifestul latest.json', async t => {
  const fetch = async () => ({
    ok: true,
    json: async () => ({
      version: '99.0.0',
      downloadUrl:
        'https://github.com/adry999/startica-portable-app/releases/download/v99.0.0/Startica_Setup_99.0.0.exe',
      sha256: 'deadbeef',
      notes: 'Note de test',
    }),
  });
  const app = await startTestApplication(t, { prefix: 'startica-session-update-', fetch });

  await app.app.checkForUpdate();
  const session = await app.get('/api/session');

  assert.equal(session.update.updateAvailable, true);
  assert.equal(session.update.latestVersion, '99.0.0');
  assert.equal(session.update.sha256, 'deadbeef');
  assert.equal(session.update.releaseUrl, 'https://github.com/adry999/startica-releases/releases/latest');
});

test('/api/session: un repo de release configurat ajunge în URL-ul verificat', async t => {
  const requestedUrls = [];
  const fetch = async url => {
    requestedUrls.push(String(url));
    return { ok: true, json: async () => ({ version: '1.0.0' }) };
  };
  const app = await startTestApplication(t, {
    prefix: 'startica-session-update-',
    fetch,
    releaseRepo: 'adry999/startica-releases',
  });

  await app.app.checkForUpdate();

  assert.equal(requestedUrls.length, 1);
  assert.equal(requestedUrls[0], 'https://github.com/adry999/startica-releases/releases/latest/download/latest.json');
});

test('POST /api/state refuză scrierea cu 409 și un mesaj explicit', async t => {
  const app = await startTestApplication(t, { prefix: 'startica-session-' });
  const result = await app.post('/api/state', {});
  assert.equal(result.status, 409);
  assert.match(result.body.error, /versiune este veche/);
});

test('POST /api/shutdown răspunde 404 când nu este permisă oprirea', async t => {
  const app = await startTestApplication(t, { prefix: 'startica-session-' });
  const result = await app.post('/api/shutdown', {});
  assert.equal(result.status, 404);
  assert.match(result.body.error, /Operațiune inexistentă/);
});

test('Oprire desktop autentificată, cu backup final și închiderea bazei', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-shutdown-'));
  const app = createApplication({
    dataDir: join(dir, 'data'),
    backupDir: join(dir, 'backups'),
    home: dir,
    allowShutdown: true,
  });
  await new Promise(done => app.server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const denied = await fetch(url + '/api/shutdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(denied.status, 403);
    await denied.json();
    const { token } = await (await fetch(url + '/api/session')).json();
    const closed = new Promise(done => app.server.once('close', done));
    const response = await fetch(url + '/api/shutdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
      body: '{}',
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    await closed;
    assert.ok(readdirSync(join(dir, 'backups')).some(name => name.includes('inchidere')));
    const check = new DatabaseSync(join(dir, 'data/startica.db'), { readOnly: true });
    assert.equal(check.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    check.close();
    // E-1 din audit: oprirea din lansator e singura cale reală de închidere — Comun\
    // (salarii/avansuri/pontaj) trebuie să aibă și ea o copie la acest moment, nu doar filiala.
    assert.ok(
      readdirSync(join(dir, 'Comun', 'Startica_Backup')).some(name => name.includes('inchidere')),
      'Comun\\ nu are nicio copie la oprirea din lansator',
    );
  } finally {
    if (app.server.listening) await app.close();
    if (
      resolve(dir).startsWith(resolve(tmpdir()) + '\\startica-shutdown-') ||
      resolve(dir).startsWith(resolve(tmpdir()) + '/startica-shutdown-')
    )
      rmSync(dir, { recursive: true, force: true });
  }
});

test('app.close() se termină cu un flux SSE (/api/sync/events) deschis, fără blocaj', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-sse-close-'));
  const app = createApplication({
    dataDir: join(dir, 'data'),
    backupDir: join(dir, 'backups'),
    home: dir,
    autoBackupIntervalMs: 0,
  });
  await new Promise(done => app.server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${app.server.address().port}`;
  try {
    // Ruta există și fără sync.json (configured:false) — deschisă și nu se citește, exact
    // ca un EventSource al webapp-ului rămas deschis într-o filă la închiderea aplicației.
    const stream = await fetch(url + '/api/sync/events');
    assert.equal(stream.status, 200);

    await Promise.race([
      app.close(),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('BLOCAT: app.close() nu s-a terminat')), 3000),
      ),
    ]);
    assert.equal(app.server.listening, false);
    await stream.body?.cancel().catch(() => {});
  } finally {
    await removeDirWithRetry(dir);
  }
});

test('al doilea POST /api/shutdown nu face un al doilea backup', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-shutdown-'));
  const app = createApplication({
    dataDir: join(dir, 'data'),
    backupDir: join(dir, 'backups'),
    home: dir,
    allowShutdown: true,
  });
  await new Promise(done => app.server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const { token } = await (await fetch(url + '/api/session')).json();
    const closed = new Promise(done => app.server.once('close', done));
    const request = () =>
      fetch(url + '/api/shutdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
        body: '{}',
      });
    const first = await request();
    assert.equal(first.status, 200);
    assert.equal((await first.json()).ok, true);
    // Al doilea apel poate ajunge la server (ok: true) sau găsi conexiunea deja închisă; ambele sunt bune.
    const second = await request().catch(() => null);
    if (second) {
      assert.equal(second.status, 200);
      assert.equal((await second.json()).ok, true);
    }
    await closed;
    assert.equal(readdirSync(join(dir, 'backups')).filter(name => name.includes('inchidere')).length, 1);
    await assert.doesNotReject(() => app.close());
  } finally {
    if (app.server.listening) await app.close();
    if (
      resolve(dir).startsWith(resolve(tmpdir()) + '\\startica-shutdown-') ||
      resolve(dir).startsWith(resolve(tmpdir()) + '/startica-shutdown-')
    )
      rmSync(dir, { recursive: true, force: true });
  }
});

// DECIZII.md punctul 55 — lastSyncedAt e persistat în sync.json (sync-last-synced-tracker.mjs)
// și expus prin syncSummary(); aici verificăm doar expunerea, cu un sync.json scris de mână
// (fără server de sincronizare real — syncSummary() doar citește fișierul).
test('/api/session: sync.json fără lastSyncedAt încă — sync.lastSyncedAt gol', async t => {
  const home = mkdtempSync(join(tmpdir(), 'startica-session-sync-'));
  t.after(() => removeDirWithRetry(home));
  writeFileSync(
    join(home, 'sync.json'),
    JSON.stringify({
      version: 1,
      serverUrl: 'https://sync.exemplu.md',
      deviceId: 'dev-1',
      deviceName: 'Calculator A',
      token: 'tok',
      connectedAt: new Date().toISOString(),
    }),
  );
  const app = await startTestApplication(t, { prefix: 'startica-session-sync-run-', home });

  const session = await app.get('/api/session');

  assert.deepEqual(session.sync, {
    configured: true,
    deviceName: 'Calculator A',
    serverUrl: 'https://sync.exemplu.md',
    lastSyncedAt: '',
  });
});

test('/api/session: sync.json cu lastSyncedAt persistat — apare în syncSummary', async t => {
  const home = mkdtempSync(join(tmpdir(), 'startica-session-sync-'));
  t.after(() => removeDirWithRetry(home));
  writeFileSync(
    join(home, 'sync.json'),
    JSON.stringify({
      version: 1,
      serverUrl: 'https://sync.exemplu.md',
      deviceId: 'dev-1',
      deviceName: 'Calculator A',
      token: 'tok',
      connectedAt: new Date().toISOString(),
      lastSyncedAt: '2026-10-01T12:00:00.000Z',
    }),
  );
  const app = await startTestApplication(t, { prefix: 'startica-session-sync-run-', home });

  const session = await app.get('/api/session');

  assert.equal(session.sync.lastSyncedAt, '2026-10-01T12:00:00.000Z');
});

// §5.3 — profilul calculatorului (31-profiluri-calculator.md)
test('/api/session: fără sync.json, profilul e Complet nerestricționat (compatibilitate)', async t => {
  const app = await startTestApplication(t, { prefix: 'startica-session-profil-' });
  const session = await app.get('/api/session');
  assert.equal(session.profile.preset, 'complet');
  assert.equal(session.profile.blocked, false);
  assert.equal(session.profile.modules.admin, 2);
});

test('/api/session: sync.json cu profil persistat îl expune ca atare', async t => {
  const home = mkdtempSync(join(tmpdir(), 'startica-session-profil-'));
  t.after(() => removeDirWithRetry(home));
  writeFileSync(
    join(home, 'sync.json'),
    JSON.stringify({
      version: 1,
      serverUrl: 'https://sync.exemplu.md',
      deviceId: 'dev-1',
      deviceName: 'Calculator Educator',
      token: 'tok',
      connectedAt: new Date().toISOString(),
      profile: {
        preset: 'educator',
        modules: { attendance: 2, children: 1, groups: 1 },
        pinModules: [],
        blocked: false,
      },
    }),
  );
  const app = await startTestApplication(t, { prefix: 'startica-session-profil-run-', home });

  const session = await app.get('/api/session');

  assert.equal(session.profile.preset, 'educator');
  assert.equal(session.profile.modules.attendance, 2);
  assert.equal(session.profile.modules.payments, 0);
});

// AUDIT-COD-02-10.md #2: /api/state trimitea tot instantaneul necondiționat — §2 ascundea doar
// în UI (ChildProfileView), dar datele ajungeau deja complete în browser, indiferent de profil.
// syncDevice.read() e cache în memorie, citit o dată la pornirea procesului (sync-device.repository.mjs)
// — nu se poate „restrânge din mers" cu un writeFileSync pe aplicația deja pornită; de-aia testul
// pornește ÎNTÂI aplicația fără profil (Complet, ca importul — rută admin — să treacă), o închide,
// scrie profilul restrâns, apoi pornește o A DOUA instanță pe ACELAȘI folder de date.
test('/api/state: pe profil Educator (payments:0), plățile nu mai ajung deloc, iar fișa copilului vine fără sumă/notă medicală', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'startica-session-profil-'));
  t.after(() => removeDirWithRetry(dir));

  const seedApp = createApplication({ dataDir: join(dir, 'data'), backupDir: join(dir, 'backups'), home: dir });
  await new Promise(done => seedApp.server.listen(0, '127.0.0.1', done));
  const seedOrigin = `http://127.0.0.1:${seedApp.server.address().port}`;
  const seedToken = (await (await fetch(seedOrigin + '/api/session')).json()).token;
  const imported = await fetch(seedOrigin + '/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Startica-Token': seedToken },
    body: JSON.stringify({
      state: {
        children: [
          {
            id: 'C1',
            contractNumber: 'C1',
            name: 'Ana Popescu',
            status: 'Activ',
            contractDate: '2026-01-10',
            attendanceDate: '2026-01-10',
            healthNotes: 'Alergie la polen',
          },
        ],
        payments: [
          {
            id: 'PAY-1',
            childId: 'C1',
            date: '2026-09-01',
            amount: 500,
            allocations: [{ month: '2026-09', amount: 500 }],
          },
        ],
        expenses: [],
        groups: [],
        categories: [],
        visits: [],
      },
      confirm: 'IMPORT',
      revision: 0,
      requestId: randomUUID(),
    }),
  });
  assert.equal(imported.status, 200, JSON.stringify(await imported.json()));
  await seedApp.close();

  writeFileSync(
    join(dir, 'sync.json'),
    JSON.stringify({
      version: 1,
      serverUrl: 'https://sync.exemplu.md',
      deviceId: 'dev-1',
      deviceName: 'Calculator Educator',
      token: 'tok',
      connectedAt: new Date().toISOString(),
      profile: {
        preset: 'educator',
        modules: { attendance: 2, children: 1, groups: 1 },
        pinModules: [],
        blocked: false,
      },
    }),
  );

  const restrictedApp = createApplication({ dataDir: join(dir, 'data'), backupDir: join(dir, 'backups'), home: dir });
  await new Promise(done => restrictedApp.server.listen(0, '127.0.0.1', done));
  t.after(() => restrictedApp.close());
  const restrictedOrigin = `http://127.0.0.1:${restrictedApp.server.address().port}`;
  const { state } = await (await fetch(restrictedOrigin + '/api/state')).json();

  assert.deepEqual(state.payments, [], 'modulul payments e 0 — plățile nu trebuie să ajungă deloc la client');
  assert.equal(state.children.length, 1);
  assert.equal(state.children[0].name, 'Ana Popescu');
  assert.equal(state.children[0].healthNotes, undefined, 'nota medicală nu trebuie trimisă fără acces la payments');
  assert.equal(state.children[0].feeHistory, undefined, 'planul tarifar nu trebuie trimis fără acces la payments');
});

// 46a (PROMPT-9 §4): StartSourceScreen se bazează pe acest semnal ca să știe dacă
// filiala activă e genuin goală (nicio evidență reală încă), nu doar „fără backup extern”.
test('/api/session: hasAnyData e fals pe un calculator nou, adevărat după primul copil', async t => {
  const app = await startTestApplication(t, { prefix: 'startica-session-hasanydata-' });

  assert.equal((await app.get('/api/session')).hasAnyData, false);

  const created = await app.post('/api/record', {
    type: 'children',
    mode: 'create',
    record: { id: 'C1', name: 'Copil test', dueDay: 10, status: 'Activ' },
    revision: 0,
    requestId: 'hasanydata-01',
  });
  assert.equal(created.status, 200, created.body.error);

  assert.equal((await app.get('/api/session')).hasAnyData, true);
});
