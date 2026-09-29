import { fail } from '#core/server/errors/domain-error.mjs';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { diffFields } from '../domain/conflict-diff.mjs';

const RESOLVE_ACTION = 'rezolvare conflict';

/** @param {Record<string, unknown> | null} payload */
function titleOf(payload) {
  return typeof payload?.name === 'string' && payload.name ? payload.name : '(ștearsă)';
}

/**
 * @param {ReturnType<typeof import('./sync-conflicts.repository.mjs').createSyncConflictsRepository>} conflicts
 * @param {'branch' | 'comun'} dataset
 */
function listOf(conflicts, dataset) {
  return conflicts
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
      // Personal 24 (decizia 9): un conflict de „staff” vine din setul comun, nu din
      // filiala activă — webapp-ul (ConflictsPage) arată „Comun” în loc de numele filialei
      // și rezolvă prin ruta potrivită (același POST, cu `dataset` în corp).
      dataset,
    }));
}

/**
 * @param {{
 *   conflicts: ReturnType<typeof import('./sync-conflicts.repository.mjs').createSyncConflictsRepository>,
 *   outbox: ReturnType<typeof import('./sync-outbox.repository.mjs').createSyncOutboxRepository>,
 *   syncState: ReturnType<typeof import('./sync-state.repository.mjs').createSyncStateRepository>,
 *   rawRecordRepository: { find: (kind: string, id: string) => unknown, save: (kind: string, record: { id: string }) => unknown, remove: (kind: string, id: string) => unknown },
 *   auditTrail: import('#shared/contracts/audit-trail.mjs').AuditTrail,
 *   getEngine: () => { noteLocalChange: () => void } | null,
 * }} repository
 * @param {{ id: string, choice: 'local' | 'remote' }} body
 * @param {{ normalize?: boolean }} [options] `normalize: false` pentru setul comun (COMMON_KINDS,
 *   ca în change-applier.mjs) — scriere brută, fără `normalizeRecord`.
 */
function resolveOn(
  { conflicts, outbox, syncState, rawRecordRepository, auditTrail, getEngine },
  body,
  { normalize = true } = {},
) {
  const conflict = conflicts.find(body.id);
  if (!conflict) fail('Conflictul nu mai există — a fost rezolvat deja.', 404);
  const outboxRow = outbox.findParked(conflict.kind, conflict.recordId);

  if (body.choice === 'remote') {
    if (conflict.remotePayload === null) {
      rawRecordRepository.remove(conflict.kind, conflict.recordId);
    } else if (normalize) {
      // B-7: pull-ul (change-applier.mjs) normalizează orice payload venit de pe server
      // înainte să-l scrie; rezolvarea unui conflict trebuie să facă la fel, altfel o
      // variantă de la o versiune mai veche a aplicației (ex. `notes` text în loc de
      // `ChildNote[]`) intră nevalidată în `records` și pică mai târziu la validateState/export.
      let normalized;
      try {
        normalized = normalizeRecord(conflict.kind, conflict.remotePayload);
      } catch (error) {
        fail(
          `Varianta de pe ${conflict.remoteDeviceName} nu poate fi aplicată (${/** @type {Error} */ (error).message}).`,
          409,
        );
      }
      rawRecordRepository.save(conflict.kind, normalized);
    } else {
      rawRecordRepository.save(conflict.kind, /** @type {{ id: string }} */ (conflict.remotePayload));
    }
    syncState.set(conflict.kind, conflict.recordId, {
      serverRevision: conflict.remoteRevision,
      updatedAt: conflict.remoteUpdatedAt,
      updatedByDevice: conflict.remoteDeviceId,
      updatedByName: conflict.remoteDeviceName,
    });
    // B-3: șterge atât rândul parcat cât și un eventual rând încă pending pentru aceeași
    // fișă (o editare locală de care conflictul nu știa) — altfel ar pleca la următorul
    // push cu o revizie de bază depășită și ar redeschide conflictul chiar împotriva
    // variantei tocmai acceptate.
    if (outboxRow) outbox.remove(outboxRow.seq, outboxRow.changeId);
    const stalePending = outbox.findPending(conflict.kind, conflict.recordId);
    if (stalePending) outbox.remove(stalePending.seq, stalePending.changeId);
    auditTrail.recordChange({
      action: `conflict: păstrată varianta de pe ${conflict.remoteDeviceName}`,
      recordType: /** @type {import('#shared/contracts/record-types.mjs').RecordType} */ (conflict.kind),
      recordId: conflict.recordId,
      before: conflict.localPayload,
      after: conflict.remotePayload,
    });
  } else {
    // B-3: trimite fișa CURENTĂ (rawRecordRepository.find), nu payload-ul din momentul
    // conflictului (row.payload/conflict.localPayload) — o editare locală făcută cât timp
    // conflictul era parcat nu trebuie pierdută, nici retrimisă ca payload vechi care ar
    // redeschide un conflict împotriva propriei editări mai noi.
    const currentPayload = rawRecordRepository.find(conflict.kind, conflict.recordId) ?? null;
    if (outboxRow) outbox.unpark(outboxRow.seq, conflict.remoteRevision, currentPayload);
    auditTrail.recordChange({
      action: 'conflict: păstrată varianta de pe acest calculator',
      recordType: /** @type {import('#shared/contracts/record-types.mjs').RecordType} */ (conflict.kind),
      recordId: conflict.recordId,
      before: conflict.remotePayload,
      after: currentPayload,
    });
    getEngine()?.noteLocalChange();
  }

  conflicts.remove(conflict.id);
}

/**
 * Rutele ecranului de conflicte (14c, Task 9 din plan): lista lor cu câmpurile
 * care diferă, și rezolvarea — păstrează varianta locală sau varianta de pe
 * celălalt calculator. Nu atinge motorul de sincronizare, doar îl anunță
 * (`getEngine().noteLocalChange()`) când varianta locală trebuie retrimisă.
 * Personal 24 (decizia 9): `common`, opțional, adaugă conflictele setului comun (kind
 * `staff`, singurul CONFLICT_KIND de acolo) la aceeași listă/rezolvare, tăgăduite
 * `dataset: 'comun'` — fără el (context de filială izolat de teste), doar cele ale
 * filialei active.
 * @param {{
 *   conflicts: ReturnType<typeof import('./sync-conflicts.repository.mjs').createSyncConflictsRepository>,
 *   outbox: ReturnType<typeof import('./sync-outbox.repository.mjs').createSyncOutboxRepository>,
 *   syncState: ReturnType<typeof import('./sync-state.repository.mjs').createSyncStateRepository>,
 *   rawRecordRepository: ReturnType<typeof import('#core/server/persistence/record-repository.mjs').createRecordRepository>,
 *   auditTrail: import('#shared/contracts/audit-trail.mjs').AuditTrail,
 *   runRevisionTransaction: ReturnType<typeof import('#core/server/persistence/revision-transaction.mjs').createRevisionTransaction>['runRevisionTransaction'],
 *   getEngine: () => { noteLocalChange: () => void } | null,
 *   common?: {
 *     conflicts: ReturnType<typeof import('./sync-conflicts.repository.mjs').createSyncConflictsRepository>,
 *     outbox: ReturnType<typeof import('./sync-outbox.repository.mjs').createSyncOutboxRepository>,
 *     state: ReturnType<typeof import('./sync-state.repository.mjs').createSyncStateRepository>,
 *     rawRepository: ReturnType<typeof import('#core/server/persistence/record-repository.mjs').createRecordRepository>,
 *     auditTrail: import('#shared/contracts/audit-trail.mjs').AuditTrail,
 *     getEngine: () => { noteLocalChange: () => void } | null,
 *     runInTransaction: <T>(fn: () => T) => T,
 *   },
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
  common,
}) {
  function listConflicts() {
    const branchRows = listOf(conflicts, 'branch');
    const commonRows = common ? listOf(common.conflicts, 'comun') : [];
    return { conflicts: [...branchRows, ...commonRows] };
  }

  /** @param {{ body: { id: string, choice: 'local' | 'remote', dataset?: 'branch' | 'comun', revision: number, requestId: string } }} request */
  function resolveConflict({ body }) {
    if (body.dataset === 'comun') {
      if (!common) fail('Setul comun nu este disponibil.', 404);
      // Fără revizie globală (decizia 2, ca orice scriere Personal): o singură tranzacție
      // proprie bazei comune, nu runRevisionTransaction (acela ține de starea filialei).
      return common.runInTransaction(() => {
        resolveOn(
          {
            conflicts: common.conflicts,
            outbox: common.outbox,
            syncState: common.state,
            rawRecordRepository: common.rawRepository,
            auditTrail: common.auditTrail,
            getEngine: common.getEngine,
          },
          body,
          // Setul comun (staff etc.) e scris brut, ca în change-applier.mjs — normalizeRecord
          // nu cunoaște aceste kind-uri.
          { normalize: false },
        );
        return { ok: true };
      });
    }
    return runRevisionTransaction(body, { action: RESOLVE_ACTION, backupBefore: false }, () => {
      resolveOn({ conflicts, outbox, syncState, rawRecordRepository, auditTrail, getEngine }, body);
    });
  }

  return [
    { method: 'GET', path: '/api/sync/conflicts', handle: listConflicts },
    { method: 'POST', path: '/api/sync/conflicts/resolve', handle: resolveConflict },
  ];
}
