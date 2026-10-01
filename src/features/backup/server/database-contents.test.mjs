import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { applySchema } from '#core/server/database/schema.mjs';
import { TYPES } from '#shared/domain/record-schema.mjs';
import { summarizeDatabaseContents } from './database-contents.mjs';

/** @param {import('node:test').TestContext} t */
function createTestDatabase(t) {
  const dir = mkdtempSync(join(tmpdir(), 'startica-db-contents-'));
  const file = join(dir, 'startica.db');
  const db = new DatabaseSync(file);
  applySchema(db);
  t.after(() => db.close());
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { db, file };
}

// Acoperirea PERSONAL_KINDS (baza comună) e verificată separat, în
// tests/architecture/ — backup/ nu are voie să importe din personal/ (regula
// feature-imports-feature); testul de-aici se oprește la TYPES (același strat,
// #shared/domain), suficient cât să dovedească gruparea pe kind.
test('grupează tabela records pe kind — acoperă toate TYPES, fără listă scrisă de mână', t => {
  const { db, file } = createTestDatabase(t);
  const insert = db.prepare('INSERT INTO records (kind, id, payload) VALUES (?, ?, ?)');
  for (const kind of TYPES) insert.run(kind, `${kind}-1`, '{}');

  const counts = summarizeDatabaseContents(file);

  for (const kind of TYPES) assert.equal(counts[kind], 1, `kind lipsă din counts: ${kind}`);
});

test('numără și tabelele dedicate (nu doar records)', t => {
  const { db, file } = createTestDatabase(t);
  db.prepare(
    "INSERT INTO attendance (child_id, date, status, updated_at) VALUES ('c1','2026-10-01','present','2026-10-01T00:00:00Z')",
  ).run();
  db.prepare(
    "INSERT INTO pool_bookings (id, child_id, coach_id, weekday, time, start_date, updated_at) VALUES ('b1','c1','coach1',1,'09:00','2026-10-01','2026-10-01T00:00:00Z')",
  ).run();

  const counts = summarizeDatabaseContents(file);

  assert.equal(counts.attendance, 1);
  assert.equal(counts.pool_bookings, 1);
});

test('exclude tabelele interne/bookkeeping', t => {
  const { file } = createTestDatabase(t);
  const counts = summarizeDatabaseContents(file);

  for (const table of [
    'meta',
    'requests',
    'settings',
    'sync_state',
    'sync_outbox',
    'sync_conflicts',
    'sqlite_sequence',
  ]) {
    assert.equal(table in counts, false, `tabel intern ar trebui exclus: ${table}`);
  }
});

test('un tabel nou, necunoscut azi, apare automat cu numele lui', t => {
  const { db, file } = createTestDatabase(t);
  db.exec('CREATE TABLE child_documents(id TEXT PRIMARY KEY)');
  db.exec("INSERT INTO child_documents (id) VALUES ('d1'), ('d2')");

  const counts = summarizeDatabaseContents(file);

  assert.equal(counts.child_documents, 2);
});

test('bază goală — fiecare tabel dedicat apare cu 0, fără intrări de kind (records e goală)', t => {
  const { file } = createTestDatabase(t);
  const counts = summarizeDatabaseContents(file);

  assert.deepEqual(counts, {
    attendance: 0,
    audit_changes: 0,
    pool_bookings: 0,
    pool_closings: 0,
    pool_sessions: 0,
    sms_log: 0,
    sms_templates: 0,
  });
});
