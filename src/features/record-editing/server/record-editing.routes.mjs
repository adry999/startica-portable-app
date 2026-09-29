import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { normalizePayerAlias } from '#shared/format/text-search.mjs';
import { assertRecordReferencesExist, assertUniqueName } from '#shared/domain/record-integrity.mjs';
import { fail } from '#core/server/errors/domain-error.mjs';

/** @typedef {import('../record-editing.types.mjs').RecordEditingRoutesDependencies} RecordEditingRoutesDependencies */
/** @typedef {import('../record-editing.types.mjs').RecordSaveRequest} RecordSaveRequest */
/** @typedef {import('../record-editing.types.mjs').RecordDeleteRequest} RecordDeleteRequest */

const SAVE_ACTION = 'salvare';
const DELETE_ACTION = 'ștergere definitivă';
// Grupele și categoriile au rute proprii de ștergere; aici doar tipurile cu arhivare.
/** @type {import('../record-editing.types.mjs').EditableRecordType[]} */
const DELETABLE_TYPES = ['children', 'payments', 'expenses', 'visits'];

/** @param {RecordEditingRoutesDependencies} dependencies */
export function createRecordEditingRoutes({ recordRepository, auditTrail, runRevisionTransaction }) {
  /** @param {RecordSaveRequest} request */
  function saveRecord(request) {
    return runRevisionTransaction(request, { action: SAVE_ACTION, backupBefore: false }, () => {
      const record = normalizeRecord(request.type, request.record);
      const existing = recordRepository.find(request.type, record.id);
      if (!['create', 'update'].includes(request.mode)) fail('Mod de salvare invalid.');
      if (request.mode === 'create' && existing) fail('ID deja folosit.', 409);
      if (request.mode === 'update' && !existing) fail('Înregistrarea nu mai există.', 409);
      // Redenumirea unei categorii trebuie să propage noul nume la cheltuielile care o
      // folosesc deja (fără FK) — doar /api/category-rename face asta, în aceeași tranzacție.
      if (request.type === 'categories' && request.mode === 'update')
        fail(
          'Redenumirea unei categorii se face din ecranul Cheltuieli, ca cheltuielile care o folosesc să se actualizeze.',
        );
      // Statutul Înscris se obține doar prin /api/visits-enrol (creează și fișa copilului
      // în același pas) — altfel /api/record ar putea lega o vizită de un copil arbitrar,
      // fără nicio fișă creată cu adevărat pentru ea.
      if (request.type === 'visits') {
        const visit = /** @type {import('#shared/contracts/record-types.mjs').Visit} */ (record);
        const previousVisit = /** @type {import('#shared/contracts/record-types.mjs').Visit | undefined} */ (existing);
        if (visit.status === 'Înscris' && previousVisit?.status !== 'Înscris')
          fail('Statutul „Înscris” se setează doar prin înscrierea copilului, nu prin editare directă.');
      }
      // „Ține minte plătitorul” (11-de-rezolvat.md §9c) se poate bifa la fiecare achitare a
      // aceluiași plătitor — a doua bifare nu trebuie să creeze un al doilea alias identic.
      // Verificat server-side (nu în client) pentru că două calculatoare pot scrie aproape
      // simultan, prin sincronizarea setului comun.
      if (request.type === 'payerAliases' && request.mode === 'create') {
        const alias = /** @type {import('#shared/contracts/record-types.mjs').PayerAlias} */ (record);
        const normalizedAlias = normalizePayerAlias(alias.alias);
        const isDuplicate = (recordRepository.readSnapshot().payerAliases ?? []).some(
          other => other.childId === alias.childId && normalizePayerAlias(other.alias) === normalizedAlias,
        );
        if (isDuplicate) return;
      }
      assertRecordReferencesExist(request.type, record, recordRepository.exists);
      assertUniqueName(request.type, record, recordRepository.readSnapshot());
      recordRepository.save(request.type, record);
      auditTrail.recordChange({
        action: existing ? 'modificare' : 'adăugare',
        recordType: request.type,
        recordId: record.id,
        before: existing,
        after: record,
      });
    });
  }

  /** @param {RecordDeleteRequest} request */
  function deleteRecord(request) {
    // Ireversibil, spre deosebire de arhivare — de-aia backup înainte.
    return runRevisionTransaction(request, { action: DELETE_ACTION, backupBefore: true }, () => {
      if (!DELETABLE_TYPES.includes(request.type)) fail('Tip invalid.');
      const record = recordRepository.find(request.type, request.id);
      if (!record) fail('Înregistrarea nu mai există.', 409);
      if (!record.archived) fail('Doar înregistrările arhivate pot fi șterse definitiv.');
      if (
        request.type === 'children' &&
        recordRepository.readSnapshot().payments.some(payment => payment.childId === request.id)
      )
        fail('Șterge mai întâi achitările copilului, altfel ar rămâne fără copil valid.');
      if (
        request.type === 'children' &&
        recordRepository.readSnapshot().visits.some(visit => visit.childId === request.id && !visit.archived)
      )
        fail('Arhivează mai întâi vizita care l-a înscris, altfel ar rămâne fără copil valid.');
      if (
        request.type === 'children' &&
        (recordRepository.readSnapshot().charges ?? []).some(charge => charge.childId === request.id)
      )
        fail('Copilul are taxe de bazin înregistrate — nu poate fi șters.');
      recordRepository.remove(request.type, request.id);
      auditTrail.recordChange({
        action: DELETE_ACTION,
        recordType: request.type,
        recordId: request.id,
        before: record,
        after: null,
      });
    });
  }

  return [
    { method: 'POST', path: '/api/record', handle: ({ body }) => saveRecord(/** @type {RecordSaveRequest} */ (body)) },
    {
      method: 'POST',
      path: '/api/record-delete',
      handle: ({ body }) => deleteRecord(/** @type {RecordDeleteRequest} */ (body)),
    },
  ];
}
