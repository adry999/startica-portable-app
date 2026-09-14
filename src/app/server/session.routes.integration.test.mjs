import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApplication, startTestApplication } from '#test-support/start-test-application.mjs';

test('/api/session întoarce un token de sesiune', async t => {
  const app = await startTestApplication(t, { prefix: 'startica-session-' });
  assert.ok(app.token && app.token.length > 0);
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
  const app = createApplication({ dataDir: join(dir, 'data'), backupDir: join(dir, 'backups'), allowShutdown: true });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
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
    const closed = new Promise(r => app.server.once('close', r));
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
