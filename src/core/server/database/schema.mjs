export const CONNECTION_PRAGMAS =
  'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;';

const SCHEMA = `CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(kind,id));
  CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,updated_at TEXT NOT NULL);
  INSERT OR IGNORE INTO meta VALUES(1,0,'');
  CREATE TABLE IF NOT EXISTS audit_changes(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,action TEXT NOT NULL,kind TEXT,record_id TEXT,before_json TEXT,after_json TEXT);
  CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,digest TEXT NOT NULL,revision INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sms_templates(id TEXT PRIMARY KEY,name TEXT NOT NULL,body TEXT NOT NULL,strip_diacritics INTEGER NOT NULL DEFAULT 1,is_default INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sms_log(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,child_id TEXT,recipient_name TEXT NOT NULL,child_name TEXT NOT NULL,phone TEXT NOT NULL,text TEXT NOT NULL,template_id TEXT,template_name TEXT NOT NULL,month TEXT,source TEXT NOT NULL,characters INTEGER NOT NULL,segments INTEGER NOT NULL,encoding TEXT NOT NULL,cost TEXT,status TEXT NOT NULL,provider_id TEXT,provider_status TEXT NOT NULL DEFAULT '',provider_error TEXT NOT NULL DEFAULT '',status_checked_at TEXT NOT NULL DEFAULT '',batch_id TEXT);
  CREATE INDEX IF NOT EXISTS sms_log_child_created ON sms_log(child_id,created_at);
  CREATE INDEX IF NOT EXISTS sms_log_status ON sms_log(status);
  CREATE TABLE IF NOT EXISTS attendance(child_id TEXT NOT NULL,date TEXT NOT NULL,status TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,PRIMARY KEY(child_id,date));
  CREATE INDEX IF NOT EXISTS attendance_date ON attendance(date);
  CREATE TABLE IF NOT EXISTS sync_state(kind TEXT NOT NULL,id TEXT NOT NULL,server_revision INTEGER NOT NULL,updated_at TEXT NOT NULL,updated_by_device TEXT NOT NULL,updated_by_name TEXT NOT NULL DEFAULT '',PRIMARY KEY(kind,id));
  CREATE TABLE IF NOT EXISTS sync_outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,change_id TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,record_id TEXT NOT NULL,base_revision INTEGER NOT NULL,payload TEXT,created_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending');
  CREATE UNIQUE INDEX IF NOT EXISTS sync_outbox_record ON sync_outbox(kind,record_id) WHERE status='pending';
  CREATE TABLE IF NOT EXISTS sync_conflicts(id TEXT PRIMARY KEY,kind TEXT NOT NULL,record_id TEXT NOT NULL,local_payload TEXT,local_updated_at TEXT NOT NULL,remote_payload TEXT,remote_revision INTEGER NOT NULL,remote_updated_at TEXT NOT NULL,remote_device_id TEXT NOT NULL,remote_device_name TEXT NOT NULL,created_at TEXT NOT NULL,outbox_seq INTEGER);
  CREATE TABLE IF NOT EXISTS pool_bookings(id TEXT PRIMARY KEY,child_id TEXT NOT NULL,coach_id TEXT NOT NULL,weekday INTEGER NOT NULL,time TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT,archived_at TEXT,updated_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS pool_bookings_slot ON pool_bookings(weekday,time);
  CREATE TABLE IF NOT EXISTS pool_sessions(booking_id TEXT NOT NULL,date TEXT NOT NULL,status TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(booking_id,date));
  CREATE INDEX IF NOT EXISTS pool_sessions_date ON pool_sessions(date);
  CREATE TABLE IF NOT EXISTS pool_closings(month TEXT PRIMARY KEY,closed_at TEXT NOT NULL);`;

/** @param {import('node:sqlite').DatabaseSync} database */
export function applySchema(database) {
  database.exec(SCHEMA);
  // SQLite nu are „ADD COLUMN IF NOT EXISTS": o bază creată înainte de acest câmp (idempotența
  // loturilor SMS, M10) nu-l primește din CREATE TABLE IF NOT EXISTS, deci se adaugă aici,
  // o singură dată; o bază nouă îl are deja, iar ALTER devine un no-op.
  ensureColumn(database, 'sms_log', 'batch_id', 'TEXT');
  database.exec('CREATE INDEX IF NOT EXISTS sms_log_batch ON sms_log(batch_id);');
  // 40b (PROMPT-8 §8.2): „doar de pe același calculator" — ștampila sesiunii active la
  // momentul scrierii (regenerată la fiecare deschidere/schimbare de filială, vezi
  // create-branch-context.mjs), comparată la POST /api/undo.
  ensureColumn(database, 'audit_changes', 'session_token', 'TEXT');
  // §5.3 (36g, „Istoric sincronizat”): calculatorul și numele lui la momentul scrierii —
  // NULL pentru intrările vechi (dinainte de această migrare) și pentru cele scrise pe un
  // calculator fără sincronizare configurată; `entry_uid` e identificatorul global (UUID),
  // distinct de `id` (autoincrement local, nu unic între calculatoare) — e recordId-ul
  // folosit pe firul de sincronizare (kind `audit_log`, vezi audit-log.repository.mjs) și
  // cheia de idempotență la aplicarea unei intrări venite de pe alt calculator (mergeSyncedEntry).
  ensureColumn(database, 'audit_changes', 'device_id', 'TEXT');
  ensureColumn(database, 'audit_changes', 'device_name', 'TEXT');
  ensureColumn(database, 'audit_changes', 'entry_uid', 'TEXT');
  database.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS audit_changes_entry_uid ON audit_changes(entry_uid) WHERE entry_uid IS NOT NULL;',
  );
}

/**
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {string} table
 * @param {string} column
 * @param {string} type
 */
function ensureColumn(database, table, column, type) {
  const columns = /** @type {{ name: string }[]} */ (database.prepare(`PRAGMA table_info(${table})`).all());
  if (!columns.some(existingColumn => existingColumn.name === column))
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
}
