import { openDatabase } from '#core/server/database/sqlite-connection.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import { createRecordRepository } from '#core/server/persistence/record-repository.mjs';
import { createRevisionTransaction } from '#core/server/persistence/revision-transaction.mjs';
import { createRouteDispatcher } from '#core/server/http/route-dispatcher.mjs';
import { createAuditLogRepository, createAuditLogRoutes } from '#features/audit-log/index.server.mjs';
import { createBackupService, createBackupRoutes } from '#features/backup/index.server.mjs';
import {
  createPaymentAssignmentService,
  createPaymentAssignmentRoutes,
} from '#features/payment-assignment/index.server.mjs';
import { createGroupsRoutes } from '#features/groups/index.server.mjs';
import { createExpenseCategoriesRoutes } from '#features/expenses/index.server.mjs';
import { createFeeSetupRoutes } from '#features/fee-setup/index.server.mjs';
import { createRecordEditingRoutes } from '#features/record-editing/index.server.mjs';
import { createVisitsService, createVisitsRoutes } from '#features/visits/index.server.mjs';
import { createChildrenRoutes } from '#features/children/index.server.mjs';
import { createDataTransferRoutes } from '#features/data-transfer/index.server.mjs';
import { findRecordIssues } from '#features/review-center/index.server.mjs';
import { createTelegramService, createTelegramRoutes } from '#features/telegram-notify/index.server.mjs';
import { createSmsService, createSmsRoutes, createSmsLogRepository } from '#features/sms-notify/index.server.mjs';
import { createAttendanceRoutes } from '#features/attendance/index.server.mjs';
import {
  createSyncOutboxRepository,
  createSyncStateRepository,
  createSyncConflictsRepository,
  createOutboxRecordingRepository,
  createChangeSink,
} from '#features/sync/index.server.mjs';
import { createSessionRoutes } from './session.routes.mjs';
import { createDiagnosticRoutes } from './diagnostic.routes.mjs';
import { createExchangeRatesRoutes } from './exchange-rates.routes.mjs';
import { createNotificationSettingsRoutes } from './notification-settings.routes.mjs';
import { createPlanPresetsRoutes } from './plan-presets.routes.mjs';
import { createKindergartenSettingsRoutes } from './kindergarten-settings.routes.mjs';
import { createReceiptNumberingService, createReceiptNumberingRoutes } from '#features/receipts/index.server.mjs';
import {
  parseExchangeRates,
  clampExchangeRates,
  parseExchangeRateSources,
  clampExchangeRateSources,
} from '#shared/domain/exchange-rates.mjs';
import { fetchBnmEurRate } from './bnm-exchange-rate.mjs';
import { today, shiftDays } from '#shared/domain/calendar-month.mjs';

/** @typedef {import('#core/server/branches/branch-registry.mjs').BranchEntry} BranchEntry */

const EXCHANGE_RATE_BACKFILL_DAYS = 30;

/**
 * Corpul lui `createApplication` de până la Faza 6 (deschiderea bazei,
 * serviciile, rutele, dispatcher-ul HTTP) — extras ca să poată fi rulat de
 * câte ori e nevoie, o dată per filială deschisă, nu doar o dată la pornirea
 * procesului (decizia 2 din docs/superpowers/plans/2026-09-27-filiale.md).
 * @param {{
 *   branch: BranchEntry,
 *   dataDir: string,
 *   backupDir: string,
 *   home: string | undefined,
 *   logFile: string | undefined,
 *   root: string,
 *   version: string,
 *   sessionToken: string,
 *   autoBackupIntervalMs: number,
 *   allowShutdown: boolean,
 *   fetch: typeof fetch,
 *   shutdown: () => void,
 *   listBranches: () => BranchEntry[],
 *   scheduleFile: string,
 *   forbiddenFolders: () => string[],
 *   branchRoutes: import('#core/server/http/route-dispatcher.mjs').RouteDefinition[],
 *   syncDevice?: { read: () => unknown, write: (device: any) => void, clear: () => void },
 * }} options
 */
export function createBranchContext({
  branch,
  dataDir,
  backupDir,
  home,
  logFile,
  root,
  version,
  sessionToken,
  autoBackupIntervalMs,
  allowShutdown,
  fetch: fetchImpl,
  shutdown,
  listBranches,
  scheduleFile,
  forbiddenFolders,
  branchRoutes,
  // Neconfigurat implicit, ca un context construit fără parametrul acesta (dacă
  // vreun test o face direct) să se comporte exact ca o instalare fără sync.json.
  syncDevice = { read: () => null, write: () => {}, clear: () => {} },
}) {
  const { db, dbFile } = openDatabase({ dataDir, backupDir });
  // A doua închidere (rută /api/shutdown și apoi app.close(), sau invers, ori
  // schimbarea filialei urmată de închiderea aplicației) ar arunca la o bază deja închisă.
  let databaseClosed = false;
  function closeDatabase() {
    if (databaseClosed) return;
    databaseClosed = true;
    db.close();
  }
  const settings = createSettingsRepository(db);
  // settings.setting citește o coloană SQLite (tip generic în node:sqlite); valorile scrise
  // sunt mereu string (vezi settings-repository.mjs), deci tipul e sigur aici.
  const readSetting = /** @type {(key: string) => string} */ (settings.setting);
  const backups = createBackupService({
    database: db,
    databaseFile: dbFile,
    backupDirectory: backupDir,
    readSetting,
    writeSetting: settings.setSetting,
    autoBackupIntervalMs,
    forbiddenFolders,
  });

  const rawRecordRepository = createRecordRepository(db);
  const auditLogRepository = createAuditLogRepository(db);

  // Sincronizare (Faza 2 a planului): trei depozite noi pe baza acestei filiale și
  // o singură verificare de activare (sync.json există), partajată de depozitul
  // împachetat mai jos, de changeSink (replaceAllRecords) și de prezență.
  const syncOutboxRepository = createSyncOutboxRepository(db);
  const syncStateRepository = createSyncStateRepository(db);
  const syncConflictsRepository = createSyncConflictsRepository(db);
  const isSyncEnabled = () => !!syncDevice.read();
  const recordRepository = createOutboxRecordingRepository(rawRecordRepository, syncOutboxRepository, isSyncEnabled);
  const syncChangeSink = createChangeSink({ outbox: syncOutboxRepository, isEnabled: isSyncEnabled });

  const { runRevisionTransaction, replaceAllRecords } = createRevisionTransaction({
    database: db,
    recordRepository,
    backups,
    auditTrail: auditLogRepository,
    changeSink: syncChangeSink,
  });

  const recordWriteDependencies = { recordRepository, auditTrail: auditLogRepository, runRevisionTransaction };
  const paymentAssignmentService = createPaymentAssignmentService(recordWriteDependencies);
  const receiptNumberingService = createReceiptNumberingService({
    ...recordWriteDependencies,
    readSetting,
    writeSetting: settings.setSetting,
  });
  const visitsService = createVisitsService(recordWriteDependencies);
  // readEnvelope() nu are câmpul „ok” din RevisionEnvelope (nu e rezultatul unei scrieri);
  // rutele de previzualizare citesc doar state/revision/updatedAt din el.
  const readEnvelope = /** @type {() => import('#shared/contracts/persistence.mjs').RevisionEnvelope} */ (
    recordRepository.readEnvelope
  );

  const routes = [
    ...createSessionRoutes({
      sessionToken,
      version,
      readEnvelope: recordRepository.readEnvelope,
      backupService: backups,
      allowShutdown: !!allowShutdown,
      shutdown,
      branch,
      listBranches,
    }),
    ...createDiagnosticRoutes({
      version,
      home,
      logFile,
      database: dbFile,
      backupDirectory: backupDir,
      readSetting,
      backupService: backups,
      allowShutdown: !!allowShutdown,
      branch,
      listBranches,
    }),
    ...createAuditLogRoutes({ auditLogRepository }),
    ...createPaymentAssignmentRoutes({ paymentAssignmentService }),
    ...createVisitsRoutes({ visitsService }),
    ...createRecordEditingRoutes(recordWriteDependencies),
    ...createChildrenRoutes({ ...recordWriteDependencies, readEnvelope }),
    ...createDataTransferRoutes({
      ...recordWriteDependencies,
      replaceAllRecords,
      readEnvelope,
      findRecordIssues,
    }),
    ...createGroupsRoutes(recordWriteDependencies),
    ...createExpenseCategoriesRoutes(recordWriteDependencies),
    ...createFeeSetupRoutes(recordWriteDependencies),
    ...createBackupRoutes({
      backupService: backups,
      readSetting,
      writeSetting: settings.setSetting,
      auditTrail: auditLogRepository,
      runRevisionTransaction,
      replaceAllRecords,
      backupDirectory: backupDir,
      forbiddenFolders,
    }),
    ...createTelegramRoutes({
      dataDirectory: dataDir,
      telegramService: createTelegramService({ fetch: fetchImpl ?? globalThis.fetch }),
      auditTrail: auditLogRepository,
    }),
    ...createSmsRoutes({
      database: db,
      dataDirectory: dataDir,
      smsService: createSmsService({ fetch: fetchImpl ?? globalThis.fetch }),
      auditTrail: auditLogRepository,
    }),
    ...createAttendanceRoutes({
      database: db,
      recordRepository,
      onChange: change => syncChangeSink.record(change.kind, change.id, change.payload),
    }),
    ...createNotificationSettingsRoutes({
      scheduleFile,
      readSetting,
      writeSetting: settings.setSetting,
      auditTrail: auditLogRepository,
    }),
    ...createExchangeRatesRoutes({
      readSetting,
      writeSetting: settings.setSetting,
      fetch: fetchImpl ?? globalThis.fetch,
    }),
    ...createPlanPresetsRoutes({ readSetting, writeSetting: settings.setSetting }),
    ...createKindergartenSettingsRoutes({ readSetting, writeSetting: settings.setSetting }),
    ...createReceiptNumberingRoutes({ receiptNumberingService }),
    ...branchRoutes,
  ];

  const { dispatchRequest } = createRouteDispatcher({
    root,
    sessionToken,
    // Fiecare feature își tipează propriile rute; adunate aici, TS lărgește
    // `method` la string — cast spre forma așteptată de dispatcher.
    routes: /** @type {import('#core/server/http/route-dispatcher.mjs').RouteDefinition[]} */ (routes),
  });

  // Apelat la deschiderea oricărei filiale (pornirea procesului sau o schimbare —
  // decizia 7 din plan): completează retroactiv orice zi lucrătoare fără curs
  // salvat, nu doar ziua curentă — dacă aplicația a stat închisă câteva zile, un
  // calcul ulterior tot trebuie să găsească exact cursul zilei respective, nu doar
  // pe cel mai recent cunoscut. Fără istoric deloc (filială nouă), completarea se
  // oprește la ultimele EXCHANGE_RATE_BACKFILL_DAYS zile. Nu aruncă niciodată — o
  // zi fără curs publicat (weekend, sărbătoare) sau un eșec de rețea rămâne pur și
  // simplu necompletată, fără să oprească celelalte zile din interval.
  async function refreshExchangeRateIfMissing() {
    const todayStr = today();
    const current = parseExchangeRates(readSetting('exchangeRates'));
    const currentSources = parseExchangeRateSources(readSetting('exchangeRateSources'));
    const lastKnownDate = Object.keys(current).sort().at(-1);
    const startDate = lastKnownDate ? shiftDays(lastKnownDate, 1) : shiftDays(todayStr, -EXCHANGE_RATE_BACKFILL_DAYS);
    if (startDate > todayStr) return;

    const rates = { ...current };
    const sources = { ...currentSources };
    for (let date = startDate; date <= todayStr; date = shiftDays(date, 1)) {
      if (Object.hasOwn(rates, date)) continue;
      const result = await fetchBnmEurRate({ fetch: fetchImpl ?? globalThis.fetch, date });
      if ('rate' in result) {
        rates[date] = result.rate;
        sources[date] = 'bnm';
      }
    }
    settings.setSetting('exchangeRates', JSON.stringify(clampExchangeRates(rates)));
    settings.setSetting('exchangeRateSources', JSON.stringify(clampExchangeRateSources(sources)));
  }

  // Rulat la fiecare deschidere a acestei filiale (pornirea procesului sau
  // după o schimbare din selector), nu doar o dată per proces: fiecare filială
  // are propriile note medicale, propriul jurnal SMS și propriul curs BNM.
  function runStartupSweeps() {
    try {
      visitsService.expireHealthNotes();
    } catch (e) {
      console.error('Expirare date medicale: ' + /** @type {Error} */ (e).message);
    }
    try {
      createSmsLogRepository(db).expireOldEntries(today());
    } catch (e) {
      console.error('Expirare jurnal SMS: ' + /** @type {Error} */ (e).message);
    }
    // refreshExchangeRateIfMissing e asincronă: un try/catch sincron în jurul apelului
    // (fără await) nu prinde niciodată respingerea ei — .catch() e singurul mod corect,
    // altfel o filială închisă chiar când sweep-ul rulează ar lăsa o respingere netratată.
    refreshExchangeRateIfMissing().catch(e => {
      console.error('Curs BNM la pornire: ' + /** @type {Error} */ (e).message);
    });
  }

  return {
    branch,
    db,
    dbFile,
    dataDir,
    backupDir,
    backups,
    recordRepository,
    auditLogRepository,
    readSetting,
    // Motorul de sincronizare (Faza 3, nu construită aici) se leagă de exact aceste
    // depozite; rawRecordRepository e drumul prin care aplică modificările primite
    // de pe server, ca ele să nu se întoarcă în propriul outbox (decizia 4 din plan).
    sync: {
      outbox: syncOutboxRepository,
      state: syncStateRepository,
      conflicts: syncConflictsRepository,
      rawRecordRepository,
    },
    dispatchRequest,
    runStartupSweeps,
    envelope: recordRepository.readEnvelope,
    backup: backups.backup,
    safeBackup: backups.safeBackup,
    health: backups.health,
    expireHealthNotes: visitsService.expireHealthNotes,
    // Un al doilea repository doar pentru sweep e mai simplu decât să scoatem instanța rutelor.
    /** @param {string} [todayStr] */
    expireSmsLog: (todayStr = today()) => createSmsLogRepository(db).expireOldEntries(todayStr),
    refreshExchangeRateIfMissing,
    close: () => {
      backups.cancelScheduledBackup();
      closeDatabase();
    },
  };
}
