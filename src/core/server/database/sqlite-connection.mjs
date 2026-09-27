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
  try {
    db.exec(CONNECTION_PRAGMAS);
    applySchema(db);
    runMigrations(db, backupDir, isNewDatabase);
  } catch (error) {
    // O bază coruptă (ex. o filială care nu se poate deschide, Faza 6) trebuie să elibereze
    // imediat fișierul — altfel fiecare încercare ar lăsa în urmă un lacăt pe disc.
    try {
      db.close();
    } catch {
      // ignorat: baza poate fi deja într-o stare din care nu se mai poate închide normal.
    }
    throw error;
  }
  return { db, dbFile };
}

// Proces separat (rezumatul Telegram), fără schemă sau migrări: nu are voie să scrie niciodată în bază.
export function openDatabaseReadOnly({ dataDir }) {
  const dbFile = join(dataDir, 'startica.db');
  if (!existsSync(dbFile)) return null;
  const db = new DatabaseSync(dbFile, { readOnly: true });
  db.exec('PRAGMA busy_timeout=5000;');
  return { db, dbFile };
}
