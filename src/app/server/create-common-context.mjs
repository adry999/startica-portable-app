import { COMMON_DATASET_ID } from '#config/environment.mjs';
import { openDatabase } from '#core/server/database/sqlite-connection.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import { createKindRepository } from '#core/server/persistence/kind-repository.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createBackupService } from '#features/backup/index.server.mjs';
import { createAuditLogRepository } from '#features/audit-log/index.server.mjs';
import { commonDirectories } from '#core/server/branches/branch-layout.mjs';
import {
  createSyncOutboxRepository,
  createSyncStateRepository,
  createSyncConflictsRepository,
  createChangeSink,
  createSyncAttendanceWriter,
  createSyncPoolWriter,
  createSyncHttpClient,
  createSyncEngine,
} from '#features/sync/index.server.mjs';

/**
 * Baza de instalare, comună ambelor filiale (Personal 24 — decizia 1 din
 * docs/superpowers/plans/2026-09-27-personal-bazin.md): un singur fișier `<home>\Comun\Startica_Date\startica.db`,
 * deschis o singură dată per proces, alături de contextul filialei active — nu se
 * închide/reconstruiește la schimbarea filialei. Reutilizează exact aceeași schemă
 * (applySchema) ca o filială: tabelele attendance/sms_* rămân neatinse aici, dar o
 * singură verificare de integritate e mai simplă decât una separată. Motorul propriu de
 * sincronizare (decizia 9, „Changes to the sync plan”) tratează acest fișier ca al doilea
 * dataset, cu id fix `comun` — pornit o singură dată, la fel ca acest context, și
 * nereconstruit la schimbarea filialei (spre deosebire de motorul unei filiale).
 * @param {{
 *   home: string,
 *   autoBackupIntervalMs: number,
 *   syncDevice?: { read: () => import('#features/sync/index.server.mjs').SyncDeviceFile | null },
 *   fetch?: typeof fetch,
 *   onChange?: (change: { kind: string, id: string, payload: unknown | null }) => void,
 *   onSyncStatus?: (status: unknown) => void,
 *   onSyncRecordsChanged?: (revision: number) => void,
 * }} options
 */
export function createCommonContext({
  home,
  autoBackupIntervalMs,
  syncDevice = { read: () => null },
  fetch: fetchImpl = globalThis.fetch,
  onChange,
  onSyncStatus,
  onSyncRecordsChanged,
}) {
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

  // Sincronizare (decizia 9): aceleași trei depozite ca o filială, pe schema comună —
  // applySchema (openDatabase, mai sus) le-a creat deja, la fel ca sync_outbox al oricărei
  // filiale (schema e una singură, comună — vezi #core/server/database/schema.mjs).
  const syncOutboxRepository = createSyncOutboxRepository(db);
  const syncStateRepository = createSyncStateRepository(db);
  const syncConflictsRepository = createSyncConflictsRepository(db);
  const isSyncEnabled = () => !!syncDevice.read();
  const syncChangeSink = createChangeSink({ outbox: syncOutboxRepository, isEnabled: isSyncEnabled });
  // createRecordRepository, NU createKindRepository: motorul (sync-engine.service.mjs) rulează
  // fiecare lot de modificări în PROPRIA tranzacție (BEGIN IMMEDIATE brut) — save/remove ale lui
  // createKindRepository își deschid mereu propria tranzacție (bun pentru un apel de sine
  // stătător, ca o rută), ceea ce ar arunca „cannot start a transaction within a transaction”
  // dacă ar fi imbricat aici. Fără onChange, exact ca la o filială (decizia 4): o modificare
  // primită de pe alt calculator nu se întoarce în propria coadă de trimis. Tabela e aceeași
  // `records(kind,id,payload)` ca la createKindRepository — găsește/salvează/șterge oricare
  // kind, nu doar TYPES (createRecordRepository nu-i verifică deloc numele).
  const rawKinds = createRecordRepository(db);
  const syncAuditLog = createAuditLogRepository(db);
  const syncAttendanceWriter = createSyncAttendanceWriter(db);
  const syncPoolWriter = createSyncPoolWriter(db);

  // E-1 din audit: Comun\ (salarii, avansuri, pontaj) primește acum backup automat
  // după fiecare scriere, ca o filială — altfel nu are nicio copie între pornirea
  // aplicației și oprirea ei din lansator. onChange rulează după COMMIT (kind-repository.mjs),
  // deci autoBackup() (VACUUM INTO) nu lovește peste o tranzacție încă deschisă. Aceeași
  // scriere ajunge și în coada proprie de sincronizare — Personal/Bazin nu așteaptă
  // niciodată motorul (aceeași regulă ca attendance/pool_*).
  const kinds = createKindRepository(db, {
    onChange: change => {
      backups.autoBackup();
      syncChangeSink.record(change.kind, change.id, change.payload);
      onChange?.(change);
    },
  });

  // Deblocarea PIN-ului trăiește doar în procesul curent (decizia 8): un obiect mutabil
  // simplu, partajat de pin.service.mjs (Faza 2), nu persistat niciunde.
  const pinSession = { unlockedUntil: 0, failedAttempts: 0, lockedUntil: 0 };

  /** @type {ReturnType<typeof createSyncEngine> | null} */
  let syncEngine = null;

  function buildSyncEngine() {
    const deviceFile = syncDevice.read();
    if (!deviceFile) return null;
    return createSyncEngine({
      database: db,
      // Id de dataset, nu de filială (decizia 9) — sync-server/ îl acceptă fără o
      // înregistrare în branches.json (branches.routes.mjs/changes.routes.mjs).
      branch: { id: COMMON_DATASET_ID },
      rawRecordRepository: rawKinds,
      outbox: syncOutboxRepository,
      syncState: syncStateRepository,
      conflicts: syncConflictsRepository,
      backups,
      auditTrail: syncAuditLog,
      readSetting,
      writeSetting: settings.setSetting,
      attendanceRepository: syncAttendanceWriter,
      poolRepository: syncPoolWriter,
      client: createSyncHttpClient({ serverUrl: deviceFile.serverUrl, token: deviceFile.token, fetch: fetchImpl }),
      deviceId: deviceFile.deviceId,
      deviceName: deviceFile.deviceName,
      onStatus: status => onSyncStatus?.(status),
      onRecordsChanged: revision => onSyncRecordsChanged?.(revision),
    });
  }
  syncEngine = buildSyncEngine();

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
    sync: {
      outbox: syncOutboxRepository,
      state: syncStateRepository,
      conflicts: syncConflictsRepository,
      rawRepository: rawKinds,
      auditTrail: syncAuditLog,
      getEngine: () => syncEngine,
      // Pentru rezolvarea unui conflict „staff” (sync-conflicts.routes.mjs) — fără revizie
      // globală (decizia 2), doar o tranzacție proprie bazei comune, ca runRevisionTransaction
      // pentru o filială, dar fără envelope (Personal nu e în /api/state).
      /** @template T @param {() => T} fn @returns {T} */
      runInTransaction: fn => {
        db.exec('BEGIN IMMEDIATE');
        try {
          const result = fn();
          db.exec('COMMIT');
          return result;
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      },
    },
    // Pornit o singură dată, alături de contextul comun (create-application.mjs) — spre
    // deosebire de motorul unei filiale, nu se oprește/reconstruiește la schimbarea
    // filialei. Reconectarea/deconectarea (sync.json creat sau șters) trec prin
    // reconnectSync(), apelat de create-application.mjs alături de reopenActiveBranch().
    startSync: () => syncEngine?.start(),
    reconnectSync: () => {
      syncEngine?.stop();
      syncEngine = buildSyncEngine();
      syncEngine?.start();
    },
    close: () => {
      syncEngine?.stop();
      backups.cancelScheduledBackup();
      closeDatabase();
    },
  };
}

/** @typedef {ReturnType<typeof createCommonContext>} CommonContext */
