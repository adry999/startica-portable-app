import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
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
  mkdirSync(backupDirectory);
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
    readSetting,
    writeSetting,
    autoBackupIntervalMs,
  });
  // Ordinea contează pe Windows: fișierul bazei trebuie închis înainte să fie șters folderul temporar.
  t.after(() => service.cancelScheduledBackup());
  t.after(() => database.close());
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { dir, database, backupDirectory, service, readSetting, writeSetting };
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
