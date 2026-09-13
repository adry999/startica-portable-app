import { validateState, normalizeRecord, importReport } from '../shared/domain.mjs';
import { previewChildrenCSV } from './children-csv.mjs';
import { financialImportPlan } from './financial-import.mjs';
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

    '/api/record': b =>
      store.commit(b, 'salvare', () => {
        const r = normalizeRecord(b.type, b.record),
          old = store.readRecord(b.type, r.id);
        if (!['create', 'update'].includes(b.mode)) fail('Mod de salvare invalid.');
        if (b.mode === 'create' && old) fail('ID deja folosit.', 409);
        if (b.mode === 'update' && !old) fail('Înregistrarea nu mai există.', 409);
        if (b.type === 'payments' && r.childId && !store.recordExists('children', r.childId))
          fail('Copilul asociat nu există.');
        if (b.type === 'children' && r.groupId && !store.recordExists('groups', r.groupId))
          fail('Grupa asociată nu există.');
        if (b.type === 'groups') {
          const clash = store
            .readState()
            .groups.some(g => g.id !== r.id && g.name.toLocaleLowerCase('ro-RO') === r.name.toLocaleLowerCase('ro-RO'));
          if (clash) fail('Există deja o grupă cu acest nume.');
        }
        if (b.type === 'categories') {
          const clash = store
            .readState()
            .categories.some(
              g => g.id !== r.id && g.name.toLocaleLowerCase('ro-RO') === r.name.toLocaleLowerCase('ro-RO'),
            );
          if (clash) fail('Există deja o categorie cu acest nume.');
        }
        store.writeRecord(b.type, r);
        store.audit(old ? 'modificare' : 'adăugare', b.type, r.id, old, r);
      }),

    // Ștergere definitivă, doar pentru ce e deja arhivat — arhivarea rămâne
    // singura cale reversibilă; asta e ireversibilă, de-aia backup înainte.
    '/api/record-delete': b =>
      store.commit(
        b,
        'ștergere definitivă',
        () => {
          if (!['children', 'payments', 'expenses'].includes(b.type)) fail('Tip invalid.');
          const r = store.readRecord(b.type, b.id);
          if (!r) fail('Înregistrarea nu mai există.', 409);
          if (!r.archived) fail('Doar înregistrările arhivate pot fi șterse definitiv.');
          if (b.type === 'children' && store.readState().payments.some(p => p.childId === b.id))
            fail('Șterge mai întâi achitările copilului, altfel ar rămâne fără copil valid.');
          store.deleteRecord(b.type, b.id);
          store.audit('ștergere definitivă', b.type, b.id, r, null);
        },
        true,
      ),

    '/api/import-preview': b => importReport(b.state),

    '/api/financial-preview': b => {
      const current = store.envelope();
      const plan = financialImportPlan(b, current.state);
      return {
        summary: plan.summary,
        skipped: plan.skipped,
        mappedChildren: plan.mappedChildren,
        revision: current.revision,
      };
    },

    '/api/financial-import': b => {
      if (b.confirm !== 'IMPORT ISTORIC') fail('Confirmă importul istoricului financiar.');
      return store.commit(
        b,
        'import-istoric',
        () => {
          const plan = financialImportPlan(b, store.readState());
          if (!plan.summary.payments && !plan.summary.expenses) fail('Istoricul este deja importat.');
          for (const type of ['payments', 'expenses'])
            for (const r of plan.additions[type]) {
              store.writeRecord(type, r);
              store.audit('import istoric V5', type, r.id, null, r);
            }
        },
        true,
      );
    },

    '/api/children-csv-preview': b => {
      const current = store.envelope();
      return { ...previewChildrenCSV(b.csv, current.state.children), revision: current.revision };
    },

    '/api/children-csv': b => {
      if (b.confirm !== 'IMPORT COPII') fail('Scrie IMPORT COPII pentru confirmare.');
      return store.commit(
        b,
        'import-copii',
        () => {
          const report = previewChildrenCSV(b.csv, store.readState().children);
          if (report.errors.length) fail(report.errors.join('\n'));
          if (!report.additions.length) fail('Nu există copii noi de importat.');
          for (const r of report.additions) {
            store.writeRecord('children', r);
            store.audit('import copii CSV', 'children', r.id, null, r);
          }
        },
        true,
      );
    },

    '/api/import': b => {
      if (b.confirm !== 'IMPORT') fail('Confirmă importul.');
      const s = validateState(b.state);
      return store.commit(b, 'import', () => store.replace(s, 'import'), true);
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
