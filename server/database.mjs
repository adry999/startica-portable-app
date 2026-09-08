import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { TYPES } from '../shared/domain.mjs';
import { sqlString, stamp } from './util.mjs';

const PRAGMAS = 'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;';
const SCHEMA = `CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(kind,id));
  CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,updated_at TEXT NOT NULL);
  INSERT OR IGNORE INTO meta VALUES(1,0,'');
  CREATE TABLE IF NOT EXISTS audit_changes(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,action TEXT NOT NULL,kind TEXT,record_id TEXT,before_json TEXT,after_json TEXT);
  CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,digest TEXT NOT NULL,revision INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`;

const hasTable = (db, name) => !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);

// Versiunea veche păstra toată evidența într-un singur JSON, în app_state.
// Rândurile sunt mutate în records o singură dată, marcat prin settings.
function migrateLegacy(db) {
  if (db.prepare("SELECT value FROM settings WHERE key='legacyMigrated'").get()) return;
  if (!hasTable(db, 'app_state')) return;
  const row = db.prepare('SELECT payload FROM app_state WHERE id=1').get();
  if (!row) return;
  const legacy = JSON.parse(row.payload);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const type of TYPES)
      for (const r of legacy[type] || [])
        db.prepare('INSERT INTO records VALUES(?,?,?)').run(type, r.id, JSON.stringify(r));
    db.prepare('INSERT INTO settings VALUES(?,?)').run('legacyMigrated', '1');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    db.close();
    throw e;
  }
}

export function openDatabase({ dataDir, backupDir }) {
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });
  const dbFile = join(dataDir, 'startica.db');
  const db = new DatabaseSync(dbFile);
  db.exec(PRAGMAS);
  // Copie a bazei vechi înainte de a scrie noua schemă peste ea.
  if (!hasTable(db, 'records') && hasTable(db, 'app_state'))
    db.exec(`VACUUM INTO ${sqlString(join(backupDir, `startica_${stamp()}_migrare.db`))}`);
  db.exec(SCHEMA);
  migrateLegacy(db);
  return { db, dbFile };
}

export function createSettings(db) {
  return {
    setting: key => db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value || '',
    setSetting: (key, value) =>
      db
        .prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
        .run(key, value),
  };
}
