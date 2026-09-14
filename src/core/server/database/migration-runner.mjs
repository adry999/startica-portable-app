import { join } from 'node:path';
import { fileTimestamp } from '../files/file-timestamp.mjs';
import { readSettingValue, writeSettingValue } from '../settings/settings-repository.mjs';
import { sqlStringLiteral } from './sql-string-literal.mjs';
import { migration as appStateToRecords } from './migrations/001-app-state-to-records.mjs';
import { migration as groupsEntity } from './migrations/002-groups-entity.mjs';

// Lista de migrări ale schemei. Fiecare rulează o singură dată, în ordine, cu
// backup automat înainte și într-o tranzacție proprie. Adaugă una nouă la
// finalul listei, cu numărul următor — nu modifica niciodată una deja lansată,
// altfel o bază reală care a trecut deja prin ea ar rula-o din nou greșit.
const MIGRATIONS = [appStateToRecords, groupsEntity];

const hasTable = (database, name) =>
  !!database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);

// O bază fără schemaVersion memorată e fie nouă, fie a trecut deja prin
// migrarea veche (marcată prin legacyMigrated, dinainte să existe lista de
// mai jos) — în ambele cazuri migrarea #1 nu mai trebuie rulată.
function schemaVersion(database) {
  const stored = readSettingValue(database, 'schemaVersion');
  if (stored !== undefined) return Number(stored);
  return !hasTable(database, 'app_state') || readSettingValue(database, 'legacyMigrated') ? 1 : 0;
}

export function runMigrations(database, backupDir, isNewDatabase) {
  const current = schemaVersion(database);
  const pending = MIGRATIONS.filter(m => m.version > current).sort((a, b) => a.version - b.version);
  if (!pending.length) return writeSettingValue(database, 'schemaVersion', String(current));
  if (!isNewDatabase)
    database.exec(`VACUUM INTO ${sqlStringLiteral(join(backupDir, `startica_${fileTimestamp()}_migrare.db`))}`);
  for (const m of pending) {
    database.exec('BEGIN IMMEDIATE');
    try {
      m.run(database);
      writeSettingValue(database, 'schemaVersion', String(m.version));
      database.exec('COMMIT');
    } catch (e) {
      database.exec('ROLLBACK');
      database.close();
      throw e;
    }
  }
}
