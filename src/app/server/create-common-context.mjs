import { openDatabase } from '#core/server/database/sqlite-connection.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import { createKindRepository } from '#core/server/persistence/kind-repository.mjs';
import { createBackupService } from '#features/backup/index.server.mjs';
import { commonDirectories } from '#core/server/branches/branch-layout.mjs';

/**
 * Baza de instalare, comună ambelor filiale (Personal 24 — decizia 1 din
 * docs/superpowers/plans/2026-09-27-personal-bazin.md): un singur fișier `<home>\Comun\Startica_Date\startica.db`,
 * deschis o singură dată per proces, alături de contextul filialei active — nu se
 * închide/reconstruiește la schimbarea filialei. Reutilizează exact aceeași schemă
 * (applySchema) ca o filială: tabelele attendance/sms_* rămân neatinse aici, dar o
 * singură verificare de integritate e mai simplă decât una separată.
 * @param {{
 *   home: string,
 *   autoBackupIntervalMs: number,
 *   onChange?: (change: { kind: string, id: string, payload: unknown | null }) => void,
 * }} options
 */
export function createCommonContext({ home, autoBackupIntervalMs, onChange }) {
  const { dataDir, backupDir } = commonDirectories(home);
  const { db, dbFile } = openDatabase({ dataDir, backupDir });
  let databaseClosed = false;
  function closeDatabase() {
    if (databaseClosed) return;
    databaseClosed = true;
    db.close();
  }

  const settings = createSettingsRepository(db);
  const readSetting = /** @type {(key: string) => string} */ (settings.setting);
  const backups = createBackupService({
    database: db,
    databaseFile: dbFile,
    backupDirectory: backupDir,
    readSetting,
    writeSetting: settings.setSetting,
    autoBackupIntervalMs,
    // Baza comună nu are (V1) un folder extern propriu — nimic altceva nu are voie
    // să fie folderul ei, dar ea nu verifică la rândul ei niciun folder extern.
    forbiddenFolders: () => [],
  });

  // E-1 din audit: Comun\ (salarii, avansuri, pontaj) primește acum backup automat
  // după fiecare scriere, ca o filială — altfel nu are nicio copie între pornirea
  // aplicației și oprirea ei din lansator. onChange rulează după COMMIT (kind-repository.mjs),
  // deci autoBackup() (VACUUM INTO) nu lovește peste o tranzacție încă deschisă.
  const kinds = createKindRepository(db, {
    onChange: change => {
      backups.autoBackup();
      onChange?.(change);
    },
  });

  // Deblocarea PIN-ului trăiește doar în procesul curent (decizia 8): un obiect mutabil
  // simplu, partajat de pin.service.mjs (Faza 2), nu persistat niciunde.
  const pinSession = { unlockedUntil: 0, failedAttempts: 0, lockedUntil: 0 };

  return {
    db,
    dbFile,
    dataDir,
    backupDir,
    backups,
    settings,
    readSetting,
    writeSetting: settings.setSetting,
    kinds,
    pinSession,
    backup: backups.backup,
    safeBackup: backups.safeBackup,
    close: () => {
      backups.cancelScheduledBackup();
      closeDatabase();
    },
  };
}

/** @typedef {ReturnType<typeof createCommonContext>} CommonContext */
