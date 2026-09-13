export const CONNECTION_PRAGMAS =
  'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;';

const SCHEMA = `CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(kind,id));
  CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,updated_at TEXT NOT NULL);
  INSERT OR IGNORE INTO meta VALUES(1,0,'');
  CREATE TABLE IF NOT EXISTS audit_changes(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,action TEXT NOT NULL,kind TEXT,record_id TEXT,before_json TEXT,after_json TEXT);
  CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,digest TEXT NOT NULL,revision INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`;

/** @param {import('node:sqlite').DatabaseSync} database */
export function applySchema(database) {
  database.exec(SCHEMA);
}
