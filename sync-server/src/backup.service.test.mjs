import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSyncDatabase } from './database.mjs';
import { branchFloorKey, readMeta, runBackupCycle, scheduleDailyBackup } from './backup.service.mjs';

function withDatabase(t) {
  const dir = mkdtempSync(join(tmpdir(), 'sync-backup-test-'));
  const database = openSyncDatabase(dir);
  t.after(() => {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { dir, database };
}

/** @param {import('node:sqlite').DatabaseSync} database @param {string} receivedAt */
function insertChange(database, receivedAt) {
  database
    .prepare(
      'INSERT INTO changes(change_id,branch_id,kind,record_id,revision,payload,changed_at,received_at,device_id,result) VALUES (?,?,?,?,?,?,?,?,?,?)',
    )
    .run(`change-${receivedAt}`, 'branch-1', 'children', 'ID-1', 1, '{}', receivedAt, receivedAt, 'dev-1', 'applied');
}

test('backupul zilnic rulează o dată, păstrează 14 fișiere și șterge istoricul mai vechi de un an', t => {
  const { dir, database } = withDatabase(t);
  insertChange(database, '2020-01-01T00:00:00.000Z'); // mai vechi de un an
  insertChange(database, '2026-09-26T00:00:00.000Z'); // recent

  let currentNow = new Date('2026-09-27T03:00:00.000Z');
  const backup = scheduleDailyBackup({
    database,
    dataDir: dir,
    hour: 3,
    keep: 14,
    historyDays: 365,
    now: () => currentNow,
    intervalMs: 999999999,
  });
  t.after(() => backup.stop());

  const primaRulare = backup.checkOnce();
  assert.ok(primaRulare);
  assert.equal(readMeta(database, 'lastBackupAt'), currentNow.toISOString());
  const changesRamase = database.prepare('SELECT change_id FROM changes').all();
  assert.deepEqual(
    changesRamase.map(row => row.change_id),
    ['change-2026-09-26T00:00:00.000Z'],
  );

  // aceeași zi, aceeași oră: nu rulează a doua oară
  const aDouaVerificare = backup.checkOnce();
  assert.equal(aDouaVerificare, undefined);
  assert.equal(readdirSync(join(dir, 'backups')).length, 1);

  // 20 de zile ulterioare, câte o rulare pe zi → doar cele mai recente 14 fișiere rămân
  for (let zi = 1; zi <= 20; zi += 1) {
    currentNow = new Date(currentNow.getTime() + 24 * 60 * 60 * 1000);
    backup.checkOnce();
  }
  const fisiere = readdirSync(join(dir, 'backups')).filter(name => name.endsWith('.db'));
  assert.equal(fisiere.length, 14);
});

test('backupul reține în meta, per filială, cel mai mare seq șters — reper pentru cursorul expirat (410)', t => {
  const { dir, database } = withDatabase(t);
  insertChange(database, '2020-01-01T00:00:00.000Z');
  insertChange(database, '2020-01-02T00:00:00.000Z');
  insertChange(database, '2026-09-26T00:00:00.000Z');
  runBackupCycle({ database, dataDir: dir, keep: 14, historyDays: 365, now: new Date('2026-09-27T03:00:00.000Z') });
  assert.equal(readMeta(database, branchFloorKey('branch-1')), '2');
});

test('pragul e per filială (D-4): o filială fără istoric curățat nu primește pragul altei filiale', t => {
  const { dir, database } = withDatabase(t);
  insertChange(database, '2020-01-01T00:00:00.000Z'); // branch-1, curățat mai jos
  database
    .prepare(
      'INSERT INTO changes(change_id,branch_id,kind,record_id,revision,payload,changed_at,received_at,device_id,result) VALUES (?,?,?,?,?,?,?,?,?,?)',
    )
    .run('change-branch-2', 'branch-2', 'children', 'ID-2', 1, '{}', '2026-09-26T00:00:00.000Z', '2026-09-26T00:00:00.000Z', 'dev-1', 'applied');
  runBackupCycle({ database, dataDir: dir, keep: 14, historyDays: 365, now: new Date('2026-09-27T03:00:00.000Z') });
  assert.ok(Number(readMeta(database, branchFloorKey('branch-1'))) > 0);
  assert.equal(readMeta(database, branchFloorKey('branch-2')), undefined);
});

test('un runBackupCycle care aruncă (disc plin la VACUUM INTO) nu blochează reîncercarea în aceeași zi (D-3)', t => {
  const { dir, database } = withDatabase(t);
  let intaiAruncat = false;
  const execOriginal = database.exec.bind(database);
  database.exec = sql => {
    if (!intaiAruncat && sql.startsWith('VACUUM INTO')) {
      intaiAruncat = true;
      throw new Error('disc plin');
    }
    return execOriginal(sql);
  };
  const erori = [];
  let currentNow = new Date('2026-09-27T03:00:00.000Z');
  const backup = scheduleDailyBackup({
    database,
    dataDir: dir,
    hour: 3,
    keep: 14,
    historyDays: 365,
    now: () => currentNow,
    intervalMs: 999999999,
    log: mesaj => erori.push(mesaj),
  });
  t.after(() => backup.stop());

  assert.equal(backup.checkOnce(), undefined); // prima rulare eșuează
  assert.equal(erori.length, 1);
  assert.match(String(erori[0]), /disc plin/);

  const aDoua = backup.checkOnce(); // reîncearcă, tot azi — nu s-a marcat ca „rulat” la eșec
  assert.ok(aDoua);
  assert.equal(erori.length, 1); // fără o a doua eroare
});

test('o oră diferită de cea configurată nu declanșează backupul', t => {
  const { dir, database } = withDatabase(t);
  const backup = scheduleDailyBackup({
    database,
    dataDir: dir,
    hour: 3,
    keep: 14,
    historyDays: 365,
    now: () => new Date('2026-09-27T10:00:00.000Z'),
    intervalMs: 999999999,
  });
  t.after(() => backup.stop());
  assert.equal(backup.checkOnce(), undefined);
});

test('runBackupCycle creează un fișier de backup ce se poate deschide ca bază SQLite', async t => {
  const { dir, database } = withDatabase(t);
  const { backupFile } = runBackupCycle({
    database,
    dataDir: dir,
    keep: 14,
    historyDays: 365,
    now: new Date('2026-09-27T03:00:00.000Z'),
  });
  assert.ok(backupFile.endsWith('.db'));
  const { DatabaseSync } = await import('node:sqlite');
  const copie = new DatabaseSync(backupFile, { readOnly: true });
  try {
    assert.ok(copie.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='devices'").get());
  } finally {
    // închisă explicit, înainte de curățarea directorului temporar din t.after-ul de mai sus
    // (hook-urile rulează în ordinea înregistrării, nu ca o stivă).
    copie.close();
  }
});
