import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  existsSync,
  readdirSync,
  copyFileSync,
  writeFileSync,
  utimesSync,
  openSync,
  closeSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { readBackupSnapshot } from './backup-snapshot.mjs';
import { createBackupService } from './backup.service.mjs';

/** @param {import('node:test').TestContext} t */
function createHarness(t, { autoBackupIntervalMs = 0 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'startica-backup-service-'));
  const databaseFile = join(dir, 'startica.db');
  const backupDirectory = join(dir, 'backups');
  const dataDirectory = join(dir, 'data');
  mkdirSync(backupDirectory);
  mkdirSync(dataDirectory);
  const database = new DatabaseSync(databaseFile);
  applySchema(database);
  /** @type {Map<string, string>} */
  const settings = new Map();
  const readSetting = key => settings.get(key) ?? '';
  const writeSetting = (key, value) => void settings.set(key, value);
  const service = createBackupService({
    database,
    databaseFile,
    backupDirectory,
    dataDirectory,
    readSetting,
    writeSetting,
    autoBackupIntervalMs,
  });
  // Ordinea contează pe Windows: fișierul bazei trebuie închis înainte să fie șters folderul temporar.
  t.after(() => service.cancelScheduledBackup());
  t.after(() => database.close());
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { dir, database, backupDirectory, dataDirectory, service, readSetting, writeSetting };
}

test('backup() produce un fișier valid, recitibil ca stare', t => {
  const { database, service, backupDirectory } = createHarness(t);
  database
    .prepare('INSERT INTO records VALUES(?,?,?)')
    .run('children', 'ID-test', JSON.stringify({ id: 'ID-test', name: 'Copil test' }));

  const result = service.backup('manual');

  assert.ok(existsSync(result.file));
  assert.ok(readdirSync(backupDirectory).includes(result.name));
  const snapshot = readBackupSnapshot(result.file);
  assert.deepEqual(snapshot.children, [{ id: 'ID-test', name: 'Copil test' }]);
  assert.equal(service.health().lastLocal !== '', true);
});

test('safeBackup() raportează o avertizare, nu aruncă, când folderul de backup lipsește', t => {
  const { service, backupDirectory, readSetting } = createHarness(t);
  rmSync(backupDirectory, { recursive: true, force: true });

  const result = service.safeBackup('manual');

  assert.match(result.warning, /backupul local a eșuat/);
  assert.equal(
    readSetting('localError'),
    result.warning.replace('Datele sunt salvate, dar backupul local a eșuat: ', ''),
  );
});

test('backup() normalizează un motiv cu diacritice și spații la un nume ASCII', t => {
  const { service } = createHarness(t);

  const result = service.backup('inainte-ștergere definitivă');

  assert.match(result.name, /_inainte-stergere-definitiva_[0-9a-f]{8}\.db$/);
});

test('un backup existent cu diacritice și spații în nume este listat, contorizat ca permanent și rezolvabil', t => {
  const { service, backupDirectory } = createHarness(t);
  const created = service.backup('manual');
  const legacyName = 'startica_2026-09-09T19-35-04-365Z_inainte-ștergere definitivă_73c52b1f.db';
  copyFileSync(created.file, join(backupDirectory, legacyName));

  assert.ok(service.listBackups().some(entry => entry.name === legacyName));
  assert.equal(service.health().permanentBackups.count, 1);
  assert.equal(service.resolveBackupFile(legacyName), join(backupDirectory, legacyName));
});

test('resolveBackupFile respinge un nume cu separator de cale', t => {
  const { service } = createHarness(t);

  assert.throws(() => service.resolveBackupFile('../startica_x.db'));
  assert.throws(() => service.resolveBackupFile('sub/startica_x.db'));
});

test('resolveExternalBackupFile respinge folderul relativ, folderul inexistent, numele cu cale sau în afara formatului și fișierul lipsă', t => {
  const { service, dir } = createHarness(t);
  const external = join(dir, 'extern');
  mkdirSync(external);
  const name = 'startica_2026-01-01T00-00-00-000Z_manual_aaaaaaaa.db';
  writeFileSync(join(external, name), 'continut');

  assert.throws(() => service.resolveExternalBackupFile('extern-relativ', name));
  assert.throws(() => service.resolveExternalBackupFile(join(dir, 'nu-exista'), name));
  assert.throws(() => service.resolveExternalBackupFile(external, '..\\startica_x.db'));
  assert.throws(() => service.resolveExternalBackupFile(external, 'nume-invalid.db'));
  assert.throws(() => service.resolveExternalBackupFile(external, 'startica_lipsa_manual_bbbbbbbb.db'));
  assert.equal(service.resolveExternalBackupFile(external, name), join(external, name));
});

// Fișiere fictive .db (fără schema reală) doar pentru fileList()/selectBackupsToKeep(),
// care lucrează pe nume și mtime, nu pe conținut.
function writeFakeBackup(dir, mtimeMs, index, content = 'continut fictiv') {
  const name = `startica_${new Date(mtimeMs).toISOString().replace(/[:.]/g, '-')}_automat_${index.toString(16).padStart(8, '0')}.db`;
  const file = join(dir, name);
  writeFileSync(file, content);
  utimesSync(file, new Date(mtimeMs), new Date(mtimeMs));
  return { file, name };
}

test('listExternalBackups ignoră fișierele .tmp și cele străine, întoarce cele mai noi primele cu bytes', t => {
  const { service, dir } = createHarness(t);
  const external = join(dir, 'extern');
  mkdirSync(external);
  const now = Date.now();
  const older = writeFakeBackup(external, now - 2000, 0, 'a'.repeat(10));
  const newer = writeFakeBackup(external, now - 1000, 1, 'b'.repeat(20));
  writeFileSync(join(external, older.name + '.tmp'), 'partial');
  writeFileSync(join(external, 'notite.txt'), 'strain');

  const backups = service.listExternalBackups(external);

  assert.deepEqual(
    backups.map(entry => entry.name),
    [newer.name, older.name],
  );
  assert.equal(backups[0].bytes, 20);
  assert.equal(backups[1].bytes, 10);
});

test('copia externă urmează aceeași retenție ca cea locală', t => {
  const { service, dir, writeSetting } = createHarness(t);
  const external = join(dir, 'extern');
  mkdirSync(external);
  writeSetting('externalDir', external);

  const now = Date.now();
  const oldNames = [];
  for (let i = 0; i < 25; i++) {
    // i=0 cel mai vechi, i=24 cel mai nou dintre cele 25 fictive.
    oldNames.push(writeFakeBackup(external, now - (25 - i) * 1000, i).name);
  }

  const result = service.backup('manual');

  assert.equal(result.warning, '', result.warning);
  const remaining = readdirSync(external).filter(name => name.endsWith('.db'));
  assert.equal(remaining.length, 20, 'Retenția externă păstrează tot 20 de copii, ca cea locală.');
  assert.ok(remaining.includes(result.name), 'Copia nouă e mereu păstrată.');
  assert.ok(!remaining.includes(oldNames[0]), 'Cea mai veche copie fictivă a fost ștearsă.');
  assert.ok(remaining.includes(oldNames[24]), 'Cea mai recentă dintre cele vechi a fost păstrată.');
});

test('o curățare externă eșuată nu anulează copia reușită', t => {
  const { service, dir, writeSetting } = createHarness(t);
  const external = join(dir, 'extern');
  mkdirSync(external);
  writeSetting('externalDir', external);

  const now = Date.now();
  // 21 de copii fictive, mai vechi decât cea nouă: retenția (top 20) trebuie
  // să elimine exact cele mai vechi două, dintre care una rămâne blocată.
  const { file: locked } = writeFakeBackup(external, now - 21000, 0);
  for (let i = 1; i <= 20; i++) writeFakeBackup(external, now - (21 - i) * 1000, i);

  // Un handle deschis blochează unlinkSync pe Windows, deci fișierul cel mai
  // vechi (candidat sigur la ștergere) nu poate fi eliminat de pruneExternal.
  const handle = openSync(locked, 'r');
  t.after(() => {
    try {
      closeSync(handle);
    } catch {
      // deja închis
    }
  });

  const result = service.backup('manual');

  if (!existsSync(locked)) {
    t.skip('Pe acest sistem de fișiere, ștergerea unui fișier deschis a reușit.');
    return;
  }
  assert.match(result.warning, /Curățarea copiilor externe/);
  assert.ok(existsSync(join(external, result.name)), 'Copia nouă există, deși retenția externă a eșuat parțial.');
});

test('health().externalBackups numără copiile din folderul extern configurat', t => {
  const { service, dir, writeSetting } = createHarness(t);
  const external = join(dir, 'extern');
  mkdirSync(external);
  writeSetting('externalDir', external);

  let bytes = 0;
  const now = Date.now();
  for (let i = 0; i < 3; i++) {
    const size = (i + 1) * 10;
    writeFakeBackup(external, now - i * 1000, i, 'x'.repeat(size));
    bytes += size;
  }

  assert.deepEqual(service.health().externalBackups, { count: 3, bytes });

  writeSetting('externalDir', '');
  assert.deepEqual(service.health().externalBackups, { count: 0, bytes: 0 });
});

test('autoBackup() sare peste copie în interval și reîncearcă imediat după o eroare locală', t => {
  const { service, writeSetting } = createHarness(t, { autoBackupIntervalMs: 3600000 });

  const first = service.autoBackup();
  assert.equal(first.skipped, undefined);

  const second = service.autoBackup();
  assert.equal(second.skipped, true);

  writeSetting('localError', 'eroare anterioară');
  const third = service.autoBackup();
  assert.equal(third.skipped, undefined);
});
