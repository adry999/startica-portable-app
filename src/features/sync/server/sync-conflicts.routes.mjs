import { fail } from '#core/server/errors/domain-error.mjs';
import { diffFields } from '../domain/conflict-diff.mjs';

const RESOLVE_ACTION = 'rezolvare conflict';

/** @param {Record<string, unknown> | null} payload */
function titleOf(payload) {
  return typeof payload?.name === 'string' && payload.name ? payload.name : '(ștearsă)';
}

/**
 * Rutele ecranului de conflicte (14c, Task 9 din plan): lista lor cu câmpurile
 * care diferă, și rezolvarea — păstrează varianta locală sau varianta de pe
 * celălalt calculator. Nu atinge motorul de sincronizare, doar îl anunță
 * (`getEngine().noteLocalChange()`) când varianta locală trebuie retrimisă.
 * @param {{
 *   conflicts: ReturnType<typeof import('./sync-conflicts.repository.mjs').createSyncConflictsRepository>,
 *   outbox: ReturnType<typeof import('./sync-outbox.repository.mjs').createSyncOutboxRepository>,
 *   syncState: ReturnType<typeof import('./sync-state.repository.mjs').createSyncStateRepository>,
 *   rawRecordRepository: ReturnType<typeof import('#core/server/persistence/record-repository.mjs').createRecordRepository>,
 *   auditTrail: import('#shared/contracts/audit-trail.mjs').AuditTrail,
 *   runRevisionTransaction: ReturnType<typeof import('#core/server/persistence/revision-transaction.mjs').createRevisionTransaction>['runRevisionTransaction'],
 *   getEngine: () => { noteLocalChange: () => void } | null,
 * }} dependencies
 */
export function createSyncConflictsRoutes({
  conflicts,
  outbox,
  syncState,
  rawRecordRepository,
  auditTrail,
  runRevisionTransaction,
  getEngine,
}) {
  function listConflicts() {
    return {
      conflicts: conflicts
        .list()
        .filter(
          /**
           * @param {ReturnType<typeof conflicts.list>[number]} entry
           * @returns {entry is NonNullable<ReturnType<typeof conflicts.list>[number]>}
           */
          entry => entry !== undefined,
        )
        .map(entry => ({
          id: entry.id,
          kind: entry.kind,
          recordId: entry.recordId,
          title: titleOf(entry.localPayload ?? entry.remotePayload),
          subtitle: entry.kind,
          localUpdatedAt: entry.localUpdatedAt,
          remoteUpdatedAt: entry.remoteUpdatedAt,
          remoteDeviceName: entry.remoteDeviceName,
          fields: diffFields(entry.kind, entry.localPayload, entry.remotePayload),
        })),
    };
  }

  /** @param {{ body: { id: string, choice: 'local' | 'remote', revision: number, requestId: string } }} request */
  function resolveConflict({ body }) {
    return runRevisionTransaction(body, { action: RESOLVE_ACTION, backupBefore: false }, () => {
      const conflict = conflicts.find(body.id);
      if (!conflict) fail('Conflictul nu mai există — a fost rezolvat deja.', 404);
      const outboxRow = outbox.findParked(conflict.kind, conflict.recordId);

      if (body.choice === 'remote') {
        if (conflict.remotePayload === null) rawRecordRepository.remove(conflict.kind, conflict.recordId);
        else rawRecordRepository.save(conflict.kind, conflict.remotePayload);
        syncState.set(conflict.kind, conflict.recordId, {
          serverRevision: conflict.remoteRevision,
          updatedAt: conflict.remoteUpdatedAt,
          updatedByDevice: conflict.remoteDeviceId,
          updatedByName: conflict.remoteDeviceName,
        });
        if (outboxRow) outbox.remove(outboxRow.seq, outboxRow.changeId);
        auditTrail.recordChange({
          action: `conflict: păstrată varianta de pe ${conflict.remoteDeviceName}`,
          recordType: /** @type {import('#shared/contracts/record-types.mjs').RecordType} */ (conflict.kind),
          recordId: conflict.recordId,
          before: conflict.localPayload,
          after: conflict.remotePayload,
        });
      } else {
        if (outboxRow) outbox.unpark(outboxRow.seq, conflict.remoteRevision);
        auditTrail.recordChange({
          action: 'conflict: păstrată varianta de pe acest calculator',
          recordType: /** @type {import('#shared/contracts/record-types.mjs').RecordType} */ (conflict.kind),
          recordId: conflict.recordId,
          before: conflict.remotePayload,
          after: conflict.localPayload,
        });
        getEngine()?.noteLocalChange();
      }

      conflicts.remove(conflict.id);
    });
  }

  return [
    { method: 'GET', path: '/api/sync/conflicts', handle: listConflicts },
    { method: 'POST', path: '/api/sync/conflicts/resolve', handle: resolveConflict },
  ];
}
