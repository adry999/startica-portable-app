export const CONNECTION_PRAGMAS =
  'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;';

const SCHEMA = `CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(kind,id));
  CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,updated_at TEXT NOT NULL);
  INSERT OR IGNORE INTO meta VALUES(1,0,'');
  CREATE TABLE IF NOT EXISTS audit_changes(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,action TEXT NOT NULL,kind TEXT,record_id TEXT,before_json TEXT,after_json TEXT);
  CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,digest TEXT NOT NULL,revision INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sms_templates(id TEXT PRIMARY KEY,name TEXT NOT NULL,body TEXT NOT NULL,strip_diacritics INTEGER NOT NULL DEFAULT 1,is_default INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sms_log(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,child_id TEXT,recipient_name TEXT NOT NULL,child_name TEXT NOT NULL,phone TEXT NOT NULL,text TEXT NOT NULL,template_id TEXT,template_name TEXT NOT NULL,month TEXT,source TEXT NOT NULL,characters INTEGER NOT NULL,segments INTEGER NOT NULL,encoding TEXT NOT NULL,cost TEXT,status TEXT NOT NULL,provider_id TEXT,provider_status TEXT NOT NULL DEFAULT '',provider_error TEXT NOT NULL DEFAULT '',status_checked_at TEXT NOT NULL DEFAULT '');
  CREATE INDEX IF NOT EXISTS sms_log_child_created ON sms_log(child_id,created_at);
  CREATE INDEX IF NOT EXISTS sms_log_status ON sms_log(status);
  CREATE TABLE IF NOT EXISTS attendance(child_id TEXT NOT NULL,date TEXT NOT NULL,status TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,PRIMARY KEY(child_id,date));
  CREATE INDEX IF NOT EXISTS attendance_date ON attendance(date);`;

/** @param {import('node:sqlite').DatabaseSync} database */
export function applySchema(database) {
  database.exec(SCHEMA);
}
