import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// synchronous=FULL: serverul ține date pentru toate calculatoarele unei grădinițe;
// o pierdere de scriere la o cădere de curent nu e acceptabilă, ca și în aplicație.
const CONNECTION_PRAGMAS = 'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,name TEXT NOT NULL,os TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,last_branch_id TEXT,revoked_at TEXT,profile_json TEXT);
  CREATE TABLE IF NOT EXISTS pairing_codes(code TEXT PRIMARY KEY,created_by TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,used_at TEXT,attempts INTEGER NOT NULL DEFAULT 0,profile_json TEXT);
  CREATE TABLE IF NOT EXISTS branches(id TEXT PRIMARY KEY,name TEXT NOT NULL,color TEXT NOT NULL,address TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,uploaded_by TEXT,uploaded_at TEXT,next_receipt_number INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS records(branch_id TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT,updated_at TEXT NOT NULL,updated_by TEXT NOT NULL,PRIMARY KEY(branch_id,kind,id));
  CREATE TABLE IF NOT EXISTS changes(seq INTEGER PRIMARY KEY AUTOINCREMENT,change_id TEXT NOT NULL UNIQUE,branch_id TEXT NOT NULL,kind TEXT NOT NULL,record_id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT,changed_at TEXT NOT NULL,received_at TEXT NOT NULL,device_id TEXT NOT NULL,result TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS changes_branch_seq ON changes(branch_id,seq);
  CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
`;

// next_receipt_number nu e în schema Task 3 din plan (aparține Task 13, Faza 6),
// dar decizia utilizatorului #3 cere numerotare strict secvențială ținută de
// server — coloana e adăugată acum ca să nu mai fie nevoie de o migrare ulterioară.

/**
 * @param {string} dataDir
 * @returns {import('node:sqlite').DatabaseSync}
 */
export function openSyncDatabase(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const database = new DatabaseSync(join(dataDir, 'sync.db'));
  database.exec(CONNECTION_PRAGMAS);
  database.exec(SCHEMA);
  // §5.3: un server deja în producție (vezi README „Găzduire”) nu recreează tabelele —
  // `CREATE TABLE IF NOT EXISTS` nu adaugă coloane noi pe o bază existentă.
  ensureColumn(database, 'devices', 'profile_json', 'TEXT');
  ensureColumn(database, 'pairing_codes', 'profile_json', 'TEXT');
  return database;
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
