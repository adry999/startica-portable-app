import { fail } from '#core/server/errors/domain-error.mjs';
import { validateState } from '#shared/domain/record-schema.mjs';
import { buildImportReport } from '../domain/import-report.mjs';
import { planFinancialHistoryImport } from './financial-history-import.mjs';

/** @typedef {import('../data-transfer.types.mjs').DataTransferRoutesDependencies} DataTransferRoutesDependencies */

const FINANCIAL_IMPORT_CONFIRMATION = 'IMPORT ISTORIC';
const FULL_IMPORT_CONFIRMATION = 'IMPORT';
const FINANCIAL_IMPORT_AUDIT_ACTION = 'import istoric V5';

/** @param {DataTransferRoutesDependencies} dependencies */
export function createDataTransferRoutes({
  recordRepository,
  auditTrail,
  runRevisionTransaction,
  replaceAllRecords,
  readEnvelope,
  findRecordIssues,
}) {
  return [
    {
      method: 'POST',
      path: '/api/import-preview',
      /** @param {{ body: any }} request */
      handle: ({ body }) => buildImportReport(body.state, findRecordIssues),
    },
    {
      method: 'POST',
      path: '/api/financial-preview',
      /** @param {{ body: any }} request */
      handle: ({ body }) => {
        const current = readEnvelope();
        const plan = planFinancialHistoryImport(body, current.state);
        return {
          summary: plan.summary,
          skipped: plan.skipped,
          mappedChildren: plan.mappedChildren,
          revision: current.revision,
        };
      },
    },
    {
      method: 'POST',
      path: '/api/financial-import',
      /** @param {{ body: any }} request */
      handle: ({ body }) => {
        if (body.confirm !== FINANCIAL_IMPORT_CONFIRMATION) fail('Confirmă importul istoricului financiar.');
        return runRevisionTransaction(body, { action: 'import-istoric', backupBefore: true }, () => {
          const plan = planFinancialHistoryImport(body, recordRepository.readSnapshot());
          if (!plan.summary.payments && !plan.summary.expenses) fail('Istoricul este deja importat.');
          /** @type {('payments' | 'expenses')[]} */
          const recordTypesToSave = ['payments', 'expenses'];
          for (const type of recordTypesToSave)
            for (const r of plan.additions[type]) {
              recordRepository.save(type, r);
              auditTrail.recordChange({
                action: FINANCIAL_IMPORT_AUDIT_ACTION,
                recordType: type,
                recordId: r.id,
                before: null,
                after: r,
              });
            }
        });
      },
    },
    {
      method: 'POST',
      path: '/api/import',
      /** @param {{ body: any }} request */
      handle: ({ body }) => {
        if (body.confirm !== FULL_IMPORT_CONFIRMATION) fail('Confirmă importul.');
        const state = validateState(body.state);
        return runRevisionTransaction(body, { action: 'import', backupBefore: true }, () =>
          replaceAllRecords(state, 'import'),
        );
      },
    },
  ];
}
