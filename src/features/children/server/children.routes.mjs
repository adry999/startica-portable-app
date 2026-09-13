import { fail } from '#core/server/errors/domain-error.mjs';
import { previewChildrenCsvImport } from './children-csv-import.mjs';

/** @typedef {import('#shared/contracts/persistence.mjs').RecordRepository} RecordRepository */
/** @typedef {import('#shared/contracts/persistence.mjs').RunRevisionTransaction} RunRevisionTransaction */
/** @typedef {import('#shared/contracts/persistence.mjs').RevisionEnvelope} RevisionEnvelope */
/** @typedef {import('#shared/contracts/audit-trail.mjs').AuditTrail} AuditTrail */

const TRANSACTION_ACTION = 'import-copii';
const AUDIT_ACTION = 'import copii CSV';
const CONFIRMATION_PHRASE = 'IMPORT COPII';

/**
 * @param {{
 *   recordRepository: RecordRepository,
 *   auditTrail: AuditTrail,
 *   runRevisionTransaction: RunRevisionTransaction,
 *   readEnvelope: () => RevisionEnvelope,
 * }} dependencies
 */
export function createChildrenRoutes({ recordRepository, auditTrail, runRevisionTransaction, readEnvelope }) {
  /** @param {{ csv: string }} request */
  function previewChildrenCsv({ csv }) {
    const current = readEnvelope();
    return { ...previewChildrenCsvImport(csv, current.state.children), revision: current.revision };
  }

  /** @param {import('#shared/contracts/persistence.mjs').RevisionRequest & { csv: string, confirm: string }} request */
  function importChildrenCsv(request) {
    if (request.confirm !== CONFIRMATION_PHRASE) fail('Scrie IMPORT COPII pentru confirmare.');
    return runRevisionTransaction(request, { action: TRANSACTION_ACTION, backupBefore: true }, () => {
      const report = previewChildrenCsvImport(request.csv, recordRepository.readSnapshot().children);
      if (report.errors.length) fail(report.errors.join('\n'));
      if (!report.additions.length) fail('Nu există copii noi de importat.');
      for (const record of report.additions) {
        recordRepository.save('children', record);
        auditTrail.recordChange({
          action: AUDIT_ACTION,
          recordType: 'children',
          recordId: record.id,
          before: null,
          after: record,
        });
      }
    });
  }

  return [
    { method: 'POST', path: '/api/children-csv-preview', handle: ({ body }) => previewChildrenCsv(body) },
    { method: 'POST', path: '/api/children-csv', handle: ({ body }) => importChildrenCsv(body) },
  ];
}
