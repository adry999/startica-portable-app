import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApplication, startTestApplication } from '#test-support/start-test-application.mjs';

// Vezi create-application.integration.test.mjs: pe Windows, ștergerea imediat după
// close() poate lovi peste un handle eliberat cu o mică întârziere.
/** @param {string} path */
async function removeDirWithRetry(path) {
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      rmSync(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'EBUSY') throw error;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  console.warn(`Folderul temporar ${path} nu a putut fi șters (EBUSY persistent) — ignorat.`);
}

test('/api/session întoarce un token de sesiune', async t => {
  const app = await startTestApplication(t, { prefix: 'startica-session-' });
  assert.ok(app.token && app.token.length > 0);
});

test('/api/session întoarce versiunea din package.json', async t => {
  const app = await startTestApplication(t, { prefix: 'startica-session-' });
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal((await app.get('/api/session')).version, version);
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
