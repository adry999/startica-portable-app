import { fail } from '#core/server/errors/domain-error.mjs';
import { sendResponse } from '#core/server/http/json-response.mjs';
import { RESPONSE_SENT, createRouteDispatcher } from '#core/server/http/route-dispatcher.mjs';
import { createAuditLogRoutes } from '#features/audit-log/index.server.mjs';
import {
  createPaymentAssignmentRoutes,
  createPaymentAssignmentService,
} from '#features/payment-assignment/index.server.mjs';
import { createGroupsRoutes } from '#features/groups/index.server.mjs';
import { createExpenseCategoriesRoutes } from '#features/expenses/index.server.mjs';
import { createFeeSetupRoutes } from '#features/fee-setup/index.server.mjs';
import { createBackupRoutes } from '#features/backup/index.server.mjs';
import { createRecordEditingRoutes } from '#features/record-editing/index.server.mjs';
import { createChildrenRoutes } from '#features/children/index.server.mjs';
import { createDataTransferRoutes } from '#features/data-transfer/index.server.mjs';
import { findRecordIssues } from '#features/review-center/index.server.mjs';

export function createRouter(context) {
  const { root, token, dataDir, backupDir, allowShutdown, settings, backups, store, shutdown } = context;
  const { setting, setSetting } = settings;

  const read = {
    '/api/session': () => ({ token }),
    '/api/state': () => store.envelope(),
  };

  const write = {
    '/api/shutdown': (b, url, res) => {
      if (!allowShutdown) fail('Operațiune inexistentă.', 404);
      backups.cancelScheduledBackup();
      const result = backups.safeBackup('inchidere');
      sendResponse(res, { ok: true, warning: result.warning || '' });
      shutdown();
      return RESPONSE_SENT;
    },

    // Ruta de scriere a versiunii vechi. Un mesaj explicit este mai util decât 404.
    '/api/state': () => fail('Această versiune este veche. Reîncarcă pagina.', 409),
  };

  const recordWriteDependencies = {
    recordRepository: store.recordRepository,
    auditTrail: store.auditLogRepository,
    runRevisionTransaction: store.runRevisionTransaction,
  };
  const paymentAssignmentService = createPaymentAssignmentService(recordWriteDependencies);

  const routes = [
    ...Object.entries(read).map(([path, handler]) => ({ method: 'GET', path, handle: ({ url }) => handler(url) })),
    ...createAuditLogRoutes({ auditLogRepository: store.auditLogRepository }),
    ...createPaymentAssignmentRoutes({ paymentAssignmentService }),
    ...createRecordEditingRoutes(recordWriteDependencies),
    ...createChildrenRoutes({ ...recordWriteDependencies, readEnvelope: store.envelope }),
    ...createDataTransferRoutes({
      ...recordWriteDependencies,
      replaceAllRecords: store.replace,
      readEnvelope: store.envelope,
      findRecordIssues,
    }),
    ...createGroupsRoutes(recordWriteDependencies),
    ...createExpenseCategoriesRoutes(recordWriteDependencies),
    ...createFeeSetupRoutes(recordWriteDependencies),
    ...createBackupRoutes({
      backupService: backups,
      readSetting: setting,
      writeSetting: setSetting,
      auditTrail: store.auditLogRepository,
      runRevisionTransaction: store.runRevisionTransaction,
      replaceAllRecords: store.replace,
      dataDirectory: dataDir,
      backupDirectory: backupDir,
    }),
    ...Object.entries(write).map(([path, handler]) => ({
      method: 'POST',
      path,
      handle: ({ body, url, response }) => handler(body, url, response),
    })),
  ];

  return createRouteDispatcher({ root, sessionToken: token, routes }).dispatchRequest;
}
