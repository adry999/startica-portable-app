import { fail } from '#core/server/errors/domain-error.mjs';
import { applyChildFeeSetup } from '../domain/child-fee-setup.mjs';

/** @typedef {import('#shared/contracts/persistence.mjs').RecordRepository} RecordRepository */
/** @typedef {import('#shared/contracts/persistence.mjs').RunRevisionTransaction} RunRevisionTransaction */
/** @typedef {import('#shared/contracts/audit-trail.mjs').AuditTrail} AuditTrail */
/** @typedef {import('#shared/contracts/persistence.mjs').RevisionRequest} RevisionRequest */

const MAX_UPDATES_PER_REQUEST = 5000;
const TRANSACTION_ACTION = 'completare-taxe';
const AUDIT_ACTION = 'completare taxe și grupe';

/**
 * @param {{ recordRepository: RecordRepository, auditTrail: AuditTrail, runRevisionTransaction: RunRevisionTransaction }} dependencies
 */
export function createFeeSetupRoutes({ recordRepository, auditTrail, runRevisionTransaction }) {
  /** @param {RevisionRequest & { updates: unknown }} request */
  function applyChildrenFeeSetup(request) {
    if (!Array.isArray(request.updates) || !request.updates.length || request.updates.length > MAX_UPDATES_PER_REQUEST)
      fail('Lista de completări este invalidă.');
    const updates = /** @type {any[]} */ (request.updates);
    return runRevisionTransaction(request, { action: TRANSACTION_ACTION, backupBefore: true }, () => {
      const seen = new Set();
      for (const update of updates) {
        if (seen.has(update?.id)) fail(`Fișa ${update.id} apare de două ori.`);
        seen.add(update?.id);
        const before = recordRepository.find('children', update?.id);
        if (!before) fail(`Fișa ${update?.id} nu mai există. Reîncarcă datele.`, 409);
        if (update.groupId && !recordRepository.exists('groups', update.groupId)) fail('Grupa asociată nu există.');
        const after = applyChildFeeSetup(before, update);
        recordRepository.save('children', after);
        auditTrail.recordChange({ action: AUDIT_ACTION, recordType: 'children', recordId: after.id, before, after });
      }
    });
  }

  return [{ method: 'POST', path: '/api/children-setup', handle: ({ body }) => applyChildrenFeeSetup(body) }];
}
