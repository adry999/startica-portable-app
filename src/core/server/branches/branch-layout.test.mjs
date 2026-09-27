import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '#core/server/database/sqlite-connection.mjs';
import { branchDirectories, countBranchRecords } from './branch-layout.mjs';

function tempHome(t) {
  const home = mkdtempSync(join(tmpdir(), 'startica-branch-layout-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  return home;
}

test('filiala migrată folosește folderele vechi, una nouă pe cele din Filiale\\', t => {
  const home = tempHome(t);
  const legacy = { dataDir: join(home, 'Startica_Date'), backupDir: join(home, 'Startica_Backup') };

  const migrated = branchDirectories({ home, legacy, branch: { folder: null } });
  assert.deepEqual(migrated, legacy);

  const created = branchDirectories({ home, legacy, branch: { folder: 'botanica' } });
  assert.equal(created.dataDir, join(home, 'Filiale', 'botanica', 'Startica_Date'));
  assert.equal(created.backupDir, join(home, 'Filiale', 'botanica', 'Startica_Backup'));
});

test('countBranchRecords numără copiii și grupele și întoarce zero fără fișier', t => {
  const home = tempHome(t);
  const dataDir = join(home, 'Startica_Date');

  assert.deepEqual(countBranchRecords(dataDir), { children: 0, groups: 0, lastLocal: '' });

  const { db } = openDatabase({ dataDir, backupDir: join(home, 'Startica_Backup') });
  db.prepare('INSERT INTO records VALUES(?,?,?)').run('children', 'copil-1', '{"id":"copil-1"}');
  db.prepare('INSERT INTO records VALUES(?,?,?)').run('children', 'copil-2', '{"id":"copil-2"}');
  db.prepare('INSERT INTO records VALUES(?,?,?)').run('groups', 'grupa-1', '{"id":"grupa-1"}');
  db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(
    'lastLocal',
    '2026-09-27T08:00:00.000Z',
  );
  db.close();

  assert.deepEqual(countBranchRecords(dataDir), { children: 2, groups: 1, lastLocal: '2026-09-27T08:00:00.000Z' });
});
