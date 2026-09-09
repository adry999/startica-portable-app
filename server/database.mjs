import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { sqlString, stamp } from './util.mjs';
import { MIGRATIONS } from './migrations.mjs';

const PRAGMAS = 'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;';
const SCHEMA = `CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(kind,id));
  CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,updated_at TEXT NOT NULL);
  INSERT OR IGNORE INTO meta VALUES(1,0,'');
  CREATE TABLE IF NOT EXISTS audit_changes(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,action TEXT NOT NULL,kind TEXT,record_id TEXT,before_json TEXT,after_json TEXT);
  CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,digest TEXT NOT NULL,revision INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`;

const hasTable = (db, name) => !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
const getSetting = (db, key) => db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;
const setSetting = (db, key, value) =>
  db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);

// O bază fără schemaVersion memorată e fie nouă, fie a trecut deja prin
// migrarea veche (marcată prin legacyMigrated, dinainte să existe lista de
// mai jos) — în ambele cazuri migrarea #1 nu mai trebuie rulată.
function schemaVersion(db) {
  const stored = getSetting(db, 'schemaVersion');
  if (stored !== undefined) return Number(stored);
  return !hasTable(db, 'app_state') || getSetting(db, 'legacyMigrated') ? 1 : 0;
}

function runMigrations(db, backupDir, isNewDb) {
  const current = schemaVersion(db),
    pending = MIGRATIONS.filter(m => m.version > current).sort((a, b) => a.version - b.version);
  if (!pending.length) return setSetting(db, 'schemaVersion', String(current));
  if (!isNewDb) db.exec(`VACUUM INTO ${sqlString(join(backupDir, `startica_${stamp()}_migrare.db`))}`);
  for (const m of pending) {
    db.exec('BEGIN IMMEDIATE');
    try {
      m.run(db);
      setSetting(db, 'schemaVersion', String(m.version));
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      db.close();
      throw e;
    }
  }
}

export function openDatabase({ dataDir, backupDir }) {
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });
  const dbFile = join(dataDir, 'startica.db'),
    isNewDb = !existsSync(dbFile);
  const db = new DatabaseSync(dbFile);
  db.exec(PRAGMAS);
  db.exec(SCHEMA);
  runMigrations(db, backupDir, isNewDb);
  return { db, dbFile };
}

export function createSettings(db) {
  return {
    setting: key => getSetting(db, key) || '',
    setSetting: (key, value) => setSetting(db, key, value),
  };
}
