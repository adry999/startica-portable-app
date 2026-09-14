import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DEFAULT_AUTO_BACKUP_INTERVAL_MS } from '#config/environment.mjs';
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
import { createChildrenRoutes } from '#features/children/index.server.mjs';
import { createDataTransferRoutes } from '#features/data-transfer/index.server.mjs';
import { findRecordIssues } from '#features/review-center/index.server.mjs';
import { createSessionRoutes } from './session.routes.mjs';
import { createDiagnosticRoutes } from './diagnostic.routes.mjs';

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
 * }} [options]
 */
export function createApplication(options = {}) {
  const root = options.root || ROOT,
    dataDir = options.dataDir || join(root, 'Startica_Date'),
    backupDir = options.backupDir || join(root, 'Startica_Backup');
  const autoBackupIntervalMs = Number.isFinite(options.autoBackupIntervalMs)
    ? /** @type {number} */ (options.autoBackupIntervalMs)
    : DEFAULT_AUTO_BACKUP_INTERVAL_MS;

  const { db, dbFile } = openDatabase({ dataDir, backupDir });
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
        server.close(() => db.close());
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

  return {
    server,
    db,
    database: dbFile,
    backup: backups.backup,
    safeBackup: backups.safeBackup,
    health: backups.health,
    envelope: recordRepository.readEnvelope,
    close: () =>
      /** @type {Promise<void>} */ (
        new Promise(resolveClose => {
          backups.cancelScheduledBackup();
          server.close(() => {
            db.close();
            resolveClose();
          });
        })
      ),
  };
}
