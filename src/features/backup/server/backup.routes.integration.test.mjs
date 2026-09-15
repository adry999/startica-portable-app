import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { startTestApplication } from '#test-support/start-test-application.mjs';

const CHILD = { id: 'ID-1', name: 'Copil', dueDay: 10, status: 'Activ' };

// Aplicația A: are date reale și un folder extern configurat („Drive”-ul de
// dinaintea pierderii calculatorului), cu o copie de configurare deja în el.
/** @param {import('node:test').TestContext} t */
async function seedExternalBackup(t) {
  const { get, post } = await startTestApplication(t, {
    prefix: 'startica-restore-source-',
    autoBackupIntervalMs: 0,
  });
  const created = await post('/api/record', {
    type: 'children',
    mode: 'create',
    record: CHILD,
    revision: 0,
    requestId: 'seed-external-backup-01',
  });
  assert.equal(created.status, 200, created.body.error);
  const folder = mkdtempSync(join(tmpdir(), 'startica-restore-external-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const configured = await post('/api/settings', { externalDir: folder });
  assert.equal(configured.status, 200, configured.body.error);
  const listed = await get('/api/external-backups?dir=' + encodeURIComponent(folder));
  const name = listed.backups[0].name;
  const state = (await get('/api/state')).state;
  return { folder, name, state };
}

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

test('proba „calculator nou”: B restaurează din folderul extern al lui A și ajunge cu aceleași date, folder și istoric', async t => {
  const { folder, name, state } = await seedExternalBackup(t);
  const { get, post } = await startTestApplication(t, {
    prefix: 'startica-restore-new-pc-',
    autoBackupIntervalMs: 0,
  });

  const listed = await get('/api/external-backups?dir=' + encodeURIComponent(folder));
  assert.equal(listed.folder, folder);
  assert.ok(listed.backups.some(entry => entry.name === name));

  const previewQuery = 'name=' + encodeURIComponent(name) + '&dir=' + encodeURIComponent(folder);
  const preview = await get('/api/backup-preview?' + previewQuery);
  assert.deepEqual(preview.errors, []);

  const restored = await post('/api/restore', {
    name,
    dir: folder,
    confirm: 'RESTAUREAZA',
    revision: 0,
    requestId: 'restore-new-pc-01',
  });
  assert.equal(restored.status, 200, restored.body.error);

  assert.deepEqual((await get('/api/state')).state, state);

  const audit = await get('/api/audit');
  const entry = audit.entries.find(e => e.action === 'restaurare' && e.recordType === null);
  assert.ok(entry, 'lipsește intrarea de restaurare din istoric');
  assert.deepEqual(entry.after, { sursa: 'extern', folder, name });

  const health = await get('/api/health');
  assert.equal(health.externalDir, folder, 'folderul extern nu a fost preluat de la restaurare');

  const externalAfter = await get('/api/external-backups?dir=' + encodeURIComponent(folder));
  assert.ok(
    externalAfter.backups.some(entry2 => entry2.name.includes('_configurare_') && entry2.name !== name),
    'lipsește copia de configurare proaspătă din folderul extern',
  );
});

test('restaurarea externă păstrează alt folder deja configurat, cu avertisment', async t => {
  const { folder, name } = await seedExternalBackup(t);
  const { get, post } = await startTestApplication(t, {
    prefix: 'startica-restore-other-folder-',
    autoBackupIntervalMs: 0,
  });
  const otherFolder = mkdtempSync(join(tmpdir(), 'startica-restore-other-'));
  t.after(() => rmSync(otherFolder, { recursive: true, force: true }));
  const configured = await post('/api/settings', { externalDir: otherFolder });
  assert.equal(configured.status, 200, configured.body.error);

  const restored = await post('/api/restore', {
    name,
    dir: folder,
    confirm: 'RESTAUREAZA',
    revision: 0,
    requestId: 'restore-other-folder-01',
  });

  assert.equal(restored.status, 200, restored.body.error);
  assert.match(restored.body.warning, /Folderul extern configurat rămâne/);
  assert.equal((await get('/api/health')).externalDir, otherFolder, 'folderul deja configurat trebuia păstrat');
});

test('restaurarea externă nu adaugă avertisment când folderul deja configurat e cel folosit', async t => {
  const { folder, name } = await seedExternalBackup(t);
  const { get, post } = await startTestApplication(t, {
    prefix: 'startica-restore-same-folder-',
    autoBackupIntervalMs: 0,
  });
  const configured = await post('/api/settings', { externalDir: folder });
  assert.equal(configured.status, 200, configured.body.error);

  const restored = await post('/api/restore', {
    name,
    dir: folder,
    confirm: 'RESTAUREAZA',
    revision: 0,
    requestId: 'restore-same-folder-01',
  });

  assert.equal(restored.status, 200, restored.body.error);
  assert.doesNotMatch(restored.body.warning || '', /Folderul extern configurat rămâne/);
  assert.equal((await get('/api/health')).externalDir, folder);
});

test('restaurarea unei copii deteriorate din folderul extern primește mesajul specific fișierelor externe', async t => {
  const { folder } = await seedExternalBackup(t);
  const { post } = await startTestApplication(t, { prefix: 'startica-restore-damaged-', autoBackupIntervalMs: 0 });
  const damagedName = 'startica_2026-01-01T00-00-00-000Z_deteriorat_dddddddd.db';
  writeFileSync(join(folder, damagedName), 'nu e o baza de date sqlite, fisier trunchiat sau deteriorat');

  const restored = await post('/api/restore', {
    name: damagedName,
    dir: folder,
    confirm: 'RESTAUREAZA',
    revision: 0,
    requestId: 'restore-damaged-01',
  });

  assert.equal(restored.status, 400);
  assert.match(restored.body.error, /Copia nu a putut fi citită/);
});

test('restaurarea externă refuză un folder care e chiar folderul de backupuri local', async t => {
  const { dir, post } = await startTestApplication(t, { prefix: 'startica-restore-reserved-folder-' });

  const result = await post('/api/restore', {
    name: 'startica_test.db',
    dir: join(dir, 'backups'),
    confirm: 'RESTAUREAZA',
    revision: 0,
    requestId: 'restore-reserved-folder-01',
  });

  assert.equal(result.status, 400);
});

test('restaurarea externă refuză o cale de folder relativă', async t => {
  const { post } = await startTestApplication(t, { prefix: 'startica-restore-relative-folder-' });

  const result = await post('/api/restore', {
    name: 'startica_test.db',
    dir: 'un-folder-relativ',
    confirm: 'RESTAUREAZA',
    revision: 0,
    requestId: 'restore-relative-folder-01',
  });

  assert.equal(result.status, 400);
});

test('restaurarea externă refuză un nume cu separator de cale', async t => {
  const { folder } = await seedExternalBackup(t);
  const { post } = await startTestApplication(t, { prefix: 'startica-restore-path-name-' });

  const result = await post('/api/restore', {
    name: '../startica_x.db',
    dir: folder,
    confirm: 'RESTAUREAZA',
    revision: 0,
    requestId: 'restore-path-name-01',
  });

  assert.equal(result.status, 400);
});

test('GET /api/external-backups pe un folder gol întoarce o listă goală', async t => {
  const { get } = await startTestApplication(t, { prefix: 'startica-external-empty-' });
  const empty = mkdtempSync(join(tmpdir(), 'startica-restore-empty-'));
  try {
    const listed = await get('/api/external-backups?dir=' + encodeURIComponent(empty));
    assert.deepEqual(listed.backups, []);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});
