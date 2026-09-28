import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, openDatabaseReadOnly } from './sqlite-connection.mjs';
import { applySchema } from './schema.mjs';

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

  const opened = openDatabaseReadOnly({ dataDir });
  assert.ok(opened);
  const { db: readOnlyDb } = opened;
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

  const opened = openDatabaseReadOnly({ dataDir });
  assert.ok(opened);
  const { db: readOnlyDb } = opened;
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

test('schema creează sms_log și sms_templates cu indexurile lor, idempotent', t => {
  const { db } = openDatabase(createTemporaryHome(t));
  applySchema(db);
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sms_%' ORDER BY name")
    .all();
  assert.deepEqual(
    tables.map(row => row.name),
    ['sms_log', 'sms_templates'],
  );
  const indexes = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='sms_log' ORDER BY name")
    .all();
  assert.deepEqual(
    indexes.map(row => row.name),
    ['sms_log_batch', 'sms_log_child_created', 'sms_log_status'],
  );
  db.close();
});

test('schema creează attendance cu cheia (child_id,date) și indexul pe date, idempotent', t => {
  const { db } = openDatabase(createTemporaryHome(t));
  applySchema(db);
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='attendance'").get();
  assert.ok(table, 'tabelul attendance a fost creat');

  const indexes = db.prepare("PRAGMA index_list('attendance')").all();
  const indexNames = indexes.map(row => row.name);
  assert.ok(indexNames.includes('attendance_date'), 'indexul attendance_date există');
  assert.ok(
    indexes.some(row => row.origin === 'pk'),
    'indexul cheii primare (child_id,date) există',
  );

  assert.doesNotThrow(() => applySchema(db));
  db.close();
});
