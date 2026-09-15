import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdirSync, renameSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { startTestApplication } from '#test-support/start-test-application.mjs';

// Scrie direct un backup în formatul de dinaintea entității „grupe”: copiii au
// un câmp text `group`, nu există niciun rând de tipul groups. Simulează
// _migrare.db, permanentul creat automat de migrarea 002 la prima pornire pe o bază veche.
function writeOldFormatBackup(backupDir, name) {
  mkdirSync(backupDir, { recursive: true });
  const file = join(backupDir, name);
  const database = new DatabaseSync(file);
  applySchema(database);
  database
    .prepare('INSERT INTO records VALUES(?,?,?)')
    .run('children', 'C1', JSON.stringify({ id: 'C1', name: 'Ana', group: 'Fluturași' }));
  database
    .prepare('INSERT INTO records VALUES(?,?,?)')
    .run('children', 'C2', JSON.stringify({ id: 'C2', name: 'Ion', group: '' }));
  database.close();
  return file;
}

test('backup manual: creează o copie listată și actualizează health.lastLocal', async t => {
  const { get, post } = await startTestApplication(t, { prefix: 'startica-backup-routes-' });

  assert.equal((await get('/api/health')).lastLocal, '');
  const created = await post('/api/backup', {});
  assert.equal(created.status, 200);
  assert.ok(created.body.name);

  assert.ok((await get('/api/backups')).some(entry => entry.name === created.body.name));
  assert.ok((await get('/api/health')).lastLocal);
});

test('backup manual eșuat întoarce mesaj specific, nu eroare generică', async t => {
  const { post, dir } = await startTestApplication(t, { prefix: 'startica-backup-routes-' });
  renameSync(join(dir, 'backups'), join(dir, 'backups-offline'));

  const result = await post('/api/backup', {});

  assert.equal(result.status, 500);
  assert.match(result.body.error, /Backupul nu a putut fi creat/);
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

test('previzualizarea unui backup vechi, fără entitatea grupe, semnalează aducerea la zi', async t => {
  const { get, dir } = await startTestApplication(t, { prefix: 'startica-backup-routes-' });
  const name = 'startica_test_old_format.db';
  writeOldFormatBackup(join(dir, 'backups'), name);

  const preview = await get('/api/backup-preview?name=' + encodeURIComponent(name));

  assert.equal(preview.errors.length, 0);
  assert.ok(preview.notes.some(note => note.includes('Format vechi')));
});

test('restaurarea unui backup vechi, fără entitatea grupe, recreează grupele din câmpul text', async t => {
  const { get, post, dir } = await startTestApplication(t, { prefix: 'startica-backup-routes-' });
  const name = 'startica_test_old_format.db';
  writeOldFormatBackup(join(dir, 'backups'), name);

  const result = await post('/api/restore', {
    name,
    confirm: 'RESTAUREAZA',
    revision: 0,
    requestId: 'restore-request-old-format',
  });
  assert.equal(result.status, 200);

  const { state } = await get('/api/state');
  assert.equal(state.groups.length, 1);
  assert.equal(state.groups[0].name, 'Fluturași');
  const ana = state.children.find(child => child.id === 'C1');
  const ion = state.children.find(child => child.id === 'C2');
  assert.equal(ana.groupId, state.groups[0].id);
  assert.equal(ion.groupId, null);
});
