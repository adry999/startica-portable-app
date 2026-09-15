import { normalizeRecord } from '#shared/domain/record-schema.mjs';
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
