import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DEFAULT_AUTO_BACKUP_INTERVAL_MS, dataLayout } from '#config/environment.mjs';
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
import { createSessionRoutes } from './session.routes.mjs';
import { createDiagnosticRoutes } from './diagnostic.routes.mjs';
import { createExchangeRatesRoutes } from './exchange-rates.routes.mjs';
import { createNotificationSettingsRoutes } from './notification-settings.routes.mjs';
import { createPlanPresetsRoutes } from './plan-presets.routes.mjs';
import {
  parseExchangeRates,
  clampExchangeRates,
  parseExchangeRateSources,
  clampExchangeRateSources,
} from '#shared/domain/exchange-rates.mjs';
import { fetchBnmEurRate } from './bnm-exchange-rate.mjs';
import { today } from '#shared/domain/calendar-month.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
// Citit o singură dată la încărcarea modulului: versiunea nu se schimbă cât rulează procesul.
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

/**
 * @param {{
 *   root?: string,
 *   dataDir?: string,
 *   backupDir?: string,
 *   home?: string,
 *   logFile?: string,
 *   autoBackupIntervalMs?: number,
 *   allowShutdown?: boolean,
 *   fetch?: typeof fetch,
 * }} [options]
 */
export function createApplication(options = {}) {
  const root = options.root || ROOT,
    layout = dataLayout(root),
    dataDir = options.dataDir || layout.dataDir,
    backupDir = options.backupDir || layout.backupDir;
  const autoBackupIntervalMs = Number.isFinite(options.autoBackupIntervalMs)
    ? /** @type {number} */ (options.autoBackupIntervalMs)
    : DEFAULT_AUTO_BACKUP_INTERVAL_MS;

  const { db, dbFile } = openDatabase({ dataDir, backupDir });
  // A doua închidere (rută /api/shutdown și apoi app.close(), sau invers) ar arunca la o bază deja închisă.
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
    dataDirectory: dataDir,
    readSetting,
    writeSetting: settings.setSetting,
    autoBackupIntervalMs,
  });

  const recordRepository = createRecordRepository(db);
  const auditLogRepository = createAuditLogRepository(db);
  const { runRevisionTransaction, replaceAllRecords } = createRevisionTransaction({
    database: db,
    recordRepository,
    backups,
    auditTrail: auditLogRepository,
  });

  // Tokenul de sesiune se schimbă la fiecare pornire: o filă rămasă deschisă
  // dintr-o rulare anterioară trebuie să reîncarce înainte să scrie.
  const token = randomUUID();

  const recordWriteDependencies = { recordRepository, auditTrail: auditLogRepository, runRevisionTransaction };
  const paymentAssignmentService = createPaymentAssignmentService(recordWriteDependencies);
  const visitsService = createVisitsService(recordWriteDependencies);
  // readEnvelope() nu are câmpul „ok” din RevisionEnvelope (nu e rezultatul unei scrieri);
  // rutele de previzualizare citesc doar state/revision/updatedAt din el.
  const readEnvelope = /** @type {() => import('#shared/contracts/persistence.mjs').RevisionEnvelope} */ (
    recordRepository.readEnvelope
  );

  const routes = [
    ...createSessionRoutes({
      sessionToken: token,
      version,
      readEnvelope: recordRepository.readEnvelope,
      backupService: backups,
      allowShutdown: !!options.allowShutdown,
      shutdown: () => {
        server.close(() => closeDatabase());
        server.closeIdleConnections();
      },
    }),
    ...createDiagnosticRoutes({
      version,
      home: options.home,
      logFile: options.logFile,
      database: dbFile,
      backupDirectory: backupDir,
      readSetting,
      backupService: backups,
      allowShutdown: !!options.allowShutdown,
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
      dataDirectory: dataDir,
      backupDirectory: backupDir,
    }),
    ...createTelegramRoutes({
      dataDirectory: dataDir,
      telegramService: createTelegramService({ fetch: options.fetch ?? globalThis.fetch }),
      auditTrail: auditLogRepository,
    }),
    ...createNotificationSettingsRoutes({
      dataDirectory: dataDir,
      readSetting,
      writeSetting: settings.setSetting,
      auditTrail: auditLogRepository,
    }),
    ...createExchangeRatesRoutes({
      readSetting,
      writeSetting: settings.setSetting,
      fetch: options.fetch ?? globalThis.fetch,
    }),
    ...createPlanPresetsRoutes({ readSetting, writeSetting: settings.setSetting }),
  ];

  const { dispatchRequest } = createRouteDispatcher({
    root,
    sessionToken: token,
    // Fiecare feature își tipează propriile rute; adunate aici, TS lărgește
    // `method` la string — cast spre forma așteptată de dispatcher.
    routes: /** @type {import('#core/server/http/route-dispatcher.mjs').RouteDefinition[]} */ (routes),
  });
  const server = createServer((req, res) =>
    dispatchRequest(req, res, /** @type {import('node:net').AddressInfo} */ (server.address()).port),
  );

  // Apelat o dată la pornire (main.mjs): dacă ziua curentă n-are deja un curs
  // salvat, îl cere de la BNM. Nu aruncă niciodată — un eșec doar lasă cursul
  // lipsă, tratat de eurToMdlRate() prin căderea pe ultima zi cunoscută.
  async function refreshExchangeRateIfMissing() {
    const date = today();
    const current = parseExchangeRates(readSetting('exchangeRates'));
    if (Object.hasOwn(current, date)) return;
    const result = await fetchBnmEurRate({ fetch: options.fetch ?? globalThis.fetch, date });
    if ('error' in result) {
      console.error('Curs BNM la pornire: ' + result.error);
      return;
    }
    settings.setSetting('exchangeRates', JSON.stringify(clampExchangeRates({ ...current, [date]: result.rate })));
    const currentSources = parseExchangeRateSources(readSetting('exchangeRateSources'));
    settings.setSetting(
      'exchangeRateSources',
      JSON.stringify(clampExchangeRateSources({ ...currentSources, [date]: 'bnm' })),
    );
  }

  return {
    server,
    db,
    database: dbFile,
    backup: backups.backup,
    safeBackup: backups.safeBackup,
    health: backups.health,
    expireHealthNotes: visitsService.expireHealthNotes,
    refreshExchangeRateIfMissing,
    envelope: recordRepository.readEnvelope,
    close: () =>
      /** @type {Promise<void>} */ (
        new Promise(resolveClose => {
          backups.cancelScheduledBackup();
          server.close(() => {
            closeDatabase();
            resolveClose();
          });
        })
      ),
  };
}
