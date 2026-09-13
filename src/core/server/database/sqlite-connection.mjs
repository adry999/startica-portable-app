import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { applySchema, CONNECTION_PRAGMAS } from './schema.mjs';
import { runMigrations } from './migration-runner.mjs';

export function openDatabase({ dataDir, backupDir }) {
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });
  const dbFile = join(dataDir, 'startica.db');
  const isNewDatabase = !existsSync(dbFile);
  const db = new DatabaseSync(dbFile);
  db.exec(CONNECTION_PRAGMAS);
  applySchema(db);
  runMigrations(db, backupDir, isNewDatabase);
  return { db, dbFile };
}
