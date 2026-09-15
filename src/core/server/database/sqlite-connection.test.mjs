import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, openDatabaseReadOnly } from './sqlite-connection.mjs';

function createTemporaryHome(t) {
  const home = mkdtempSync(join(tmpdir(), 'startica-sqlite-connection-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  return { dataDir: join(home, 'Startica_Date'), backupDir: join(home, 'Startica_Backup') };
}

test('openDatabaseReadOnly întoarce null când fișierul bazei lipsește', t => {
  const { dataDir } = createTemporaryHome(t);
  assert.equal(openDatabaseReadOnly({ dataDir }), null);
});

test('openDatabaseReadOnly citește înregistrările scrise printr-o conexiune deschisă cu openDatabase', t => {
  const { dataDir, backupDir } = createTemporaryHome(t);
  const { db: writableDb } = openDatabase({ dataDir, backupDir });
  writableDb
    .prepare('INSERT INTO records(kind, id, payload) VALUES (?, ?, ?)')
    .run('children', 'CHILD-1', '{"name":"Ana"}');

  const { db: readOnlyDb } = openDatabaseReadOnly({ dataDir });
  const rows = readOnlyDb
    .prepare('SELECT kind, id, payload FROM records')
    .all()
    .map(row => ({ ...row }));
  readOnlyDb.close();
  writableDb.close();

  assert.deepEqual(rows, [{ kind: 'children', id: 'CHILD-1', payload: '{"name":"Ana"}' }]);
});

test('openDatabaseReadOnly refuză o scriere, ca procesul separat să nu poată altera baza', t => {
  const { dataDir, backupDir } = createTemporaryHome(t);
  const { db: writableDb } = openDatabase({ dataDir, backupDir });

  const { db: readOnlyDb } = openDatabaseReadOnly({ dataDir });
  try {
    assert.throws(
      () =>
        readOnlyDb.prepare('INSERT INTO records(kind, id, payload) VALUES (?, ?, ?)').run('children', 'CHILD-1', '{}'),
      /readonly database/,
    );
  } finally {
    readOnlyDb.close();
    writableDb.close();
  }
});
