import { fail } from '#core/server/errors/domain-error.mjs';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { KIND_MODULE } from '#shared/domain/computer-profile.mjs';
import { checkUndoEligibility, restoreValueForUndo } from '../domain/undo-eligibility.mjs';

const UNDO_ACTION = 'anulare';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordType} RecordType */

/**
 * `POST /api/undo` (40b, PROMPT-8 §8.2) — nu `/api/undo/:auditId`: dispatcher-ul din
 * `route-dispatcher.mjs` potrivește căi exacte, fără segmente dinamice (ca orice altă rută din
 * aplicație — vezi `/api/record-delete`, `/api/group-delete`), deci id-ul vine în corp, ca `type`
 * la `/api/record`. Scrie prin `recordRepository`/`runRevisionTransaction`, exact ca orice altă
 * scriere — revizia globală (altă filă a schimbat ceva între timp) și conținutul înregistrării
 * (ceva ANUME a schimbat-o pe ASTA) sunt două verificări diferite, ambele obligatorii.
 * @param {{
 *   auditLogRepository: ReturnType<typeof import('./audit-log.repository.mjs').createAuditLogRepository>,
 *   recordRepository: ReturnType<typeof import('#core/server/persistence/record-repository.mjs').createRecordRepository>,
 *   runRevisionTransaction: ReturnType<typeof import('#core/server/persistence/revision-transaction.mjs').createRevisionTransaction>['runRevisionTransaction'],
 *   sessionToken: string,
 *   assertModuleAccess: (moduleId: string | string[], options: { write: boolean }) => void,
 *   assertPinUnlocked: (moduleId: string | string[]) => void,
 * }} dependencies
 */
export function createUndoRoutes({
  auditLogRepository,
  recordRepository,
  runRevisionTransaction,
  sessionToken,
  assertModuleAccess,
  assertPinUnlocked,
}) {
  /** @param {{ auditId?: unknown, requestId: string, revision: number }} request */
  function undo(request) {
    const auditId = Number(request.auditId);
    const entry = auditLogRepository.findById(auditId);
    const currentRecord =
      entry?.recordType && entry.recordId ? recordRepository.find(entry.recordType, entry.recordId) : null;
    const eligibility = checkUndoEligibility({
      entry,
      now: new Date(),
      currentSessionToken: sessionToken,
      currentRecord,
    });
    if (!eligibility.ok) fail(eligibility.message, eligibility.status);
    // eligibility.ok garantează entry non-null, cu recordType/recordId non-null (vezi checkUndoEligibility).
    const safeEntry =
      /** @type {{ action: string, recordType: RecordType, recordId: string, before: Record<string, unknown> | null, after: Record<string, unknown> | null }} */ (
        entry
      );

    // AUDIT-COD-02-10.md #5: eligibilitatea de mai sus (15s, aceeași sesiune) NU garantează că
    // profilul calculatorului mai are acces la acest modul CHIAR ACUM — un profil restrâns/un
    // modul adăugat la pinModules de pe alt calculator conectat, chiar în această fereastră de
    // 15s, nu trebuie ocolit de anulare. Rezolvat dinamic aici (nu în route-modules.mjs), fiindcă
    // modulul depinde de `recordType`-ul intrării, cunoscut abia după căutarea ei de mai sus
    // (eligibility.ok garantează recordType non-null — vezi checkUndoEligibility). Un `recordType`
    // care n-ar avea încă o intrare în `KIND_MODULE` (kind nou, uitat la mapare) cere implicit
    // `admin`, cel mai restrictiv, ca o mapare lipsă să nu fie tăcut mai permisivă decât ar trebui.
    const undoModuleId = KIND_MODULE[safeEntry.recordType] ?? 'admin';
    assertModuleAccess(undoModuleId, { write: true });
    assertPinUnlocked(undoModuleId);

    return runRevisionTransaction(request, { action: UNDO_ACTION, backupBefore: false }, () => {
      // Recitit în tranzacție: starea verificată mai sus poate fi depășită dacă altă filă a
      // scris exact în intervalul dintre verificare și BEGIN IMMEDIATE.
      const recordNow = recordRepository.find(safeEntry.recordType, safeEntry.recordId);
      if (JSON.stringify(recordNow ?? null) !== JSON.stringify(safeEntry.after ?? null))
        fail('S-a modificat între timp.', 409);
      if (safeEntry.before === null) {
        recordRepository.remove(safeEntry.recordType, safeEntry.recordId);
      } else {
        const restored = restoreValueForUndo(safeEntry.recordType, safeEntry.before, recordNow);
        recordRepository.save(safeEntry.recordType, normalizeRecord(safeEntry.recordType, restored));
      }
      // Niciodată nu rescrie/șterge intrarea anulată — o nouă intrare de istoric, cu acțiunea
      // inversată, ca întregul traseu (acțiune → anulare) să rămână vizibil (40b, nu C2).
      auditLogRepository.recordChange({
        action: `${UNDO_ACTION}: ${safeEntry.action}`,
        recordType: safeEntry.recordType,
        recordId: safeEntry.recordId,
        before: safeEntry.after,
        after: safeEntry.before,
      });
    });
  }

  return [{ method: 'POST', path: '/api/undo', handle: ({ body }) => undo(/** @type {any} */ (body)) }];
}
