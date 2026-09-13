import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { startTestApplication } from '#test-support/start-test-application.mjs';

test('backup manual: creează o copie listată și actualizează health.lastLocal', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-backup-routes-' });

  assert.equal((await get('/api/health')).lastLocal, '');
  const created = await post('/api/backup', {});
  assert.equal(created.status, 200);
  assert.ok(created.body.name);

  assert.ok((await get('/api/backups')).some(entry => entry.name === created.body.name));
  assert.ok((await get('/api/health')).lastLocal);
});

test('previzualizarea unui backup refuză un nume cu cale', async t => {
  const { origin } = await startTestApplication(t, { prefix: 'startica-backup-routes-' });

  const response = await fetch(origin + '/api/backup-preview?name=' + encodeURIComponent('../startica.db'));

  assert.equal(response.status, 400);
});

test('restaurarea refuză fără confirmarea RESTAUREAZA', async t => {
  const { post } = await startTestApplication(t, { prefix: 'startica-backup-routes-' });
  const backup = await post('/api/backup', {});

  const result = await post('/api/restore', {
    name: backup.body.name,
    confirm: '',
    revision: 0,
    requestId: 'restore-request-01',
  });

  assert.equal(result.status, 400);
});

test('setările refuză un folder extern cu cale relativă', async t => {
  const { post } = await startTestApplication(t, { prefix: 'startica-backup-routes-' });

  const result = await post('/api/settings', { externalDir: 'backups-relativ' });

  assert.equal(result.status, 400);
});

test('setările refuză folosirea folderului de backupuri ca folder extern', async t => {
  const { post, dir } = await startTestApplication(t, { prefix: 'startica-backup-routes-' });

  const result = await post('/api/settings', { externalDir: join(dir, 'backups') });

  assert.equal(result.status, 400);
});
