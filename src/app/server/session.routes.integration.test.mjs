import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
  assert.equal(session.update.releaseUrl, 'https://github.com/adry999/startica-portable-app/releases/latest');
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
