import { today } from '#shared/domain/calendar-month.mjs';
import { textareaFieldMarkup } from '#shared/ui/form-fields.mjs';

/** @typedef {import('../record-editing.types.mjs').RecordEditorDialogDependencies} RecordEditorDialogDependencies */
/** @typedef {import('../record-editing.types.mjs').RecordEditorContext} RecordEditorContext */
/** @typedef {import('../record-editing.types.mjs').EditableRecordType} EditableRecordType */

// Port 1:1 al fostului web/ui/editor.mjs: dialogul generic (deschidere,
// salvare, arhivare, ștergere definitivă, confirmarea unei verificări),
// cu câmpurile specifice fiecărui tip injectate prin `fieldsByType`.

/** @param {RecordEditorDialogDependencies} dependencies */
export function createRecordEditorDialog({
  elements: { editor, editorForm, editorTitle, editorFields, editorError, editorSave },
  fieldsByType,
  sessionState,
  readRecords,
  submitMutation,
  showNotice,
  renderSaveStatus,
  readExpenseCategoryNames,
}) {
  /**
   * @param {'create' | 'update'} mode
   * @param {any} previousRecord
   * @returns {RecordEditorContext}
   */
  function buildContext(mode, previousRecord) {
    return {
      records: readRecords(),
      today,
      mode,
      previousRecord,
      markDirty: () => {
        sessionState.editorDirty = true;
      },
      renderSaveStatus,
      confirm: message => window.confirm(message),
      readExpenseCategoryNames,
    };
  }

  /**
   * @param {EditableRecordType} type
   * @param {string} [id]
   */
  function openEditor(type, id) {
    if (!sessionState.ready || sessionState.pending) {
      showNotice('Reîncarcă datele înainte de a deschide un formular.', true);
      return;
    }
    const fields = fieldsByType[type];
    const records = readRecords();
    const existing = /** @type {any[]} */ (records[type]).find(r => r.id === id);
    const record = structuredClone(existing || { id: `${fields.idPrefix}-${crypto.randomUUID()}` });
    const mode = existing ? 'update' : 'create';
    // Revizia este reținută la deschidere: salvarea se compară cu datele pe care
    // utilizatorul chiar le-a văzut, nu cu cele sosite între timp.
    sessionState.editor = { type, record, mode, revision: sessionState.revision };
    const context = buildContext(mode, record);
    editorTitle.textContent = fields.title(record, mode);
    editorError.textContent = '';
    editorFields.innerHTML = fields.markup(record, context) + textareaFieldMarkup('notes', 'Observații', record.notes);
    fields.bind?.(editorForm, context);
    // bind() a putut marca formularul ca modificat; deschiderea nu este o modificare.
    sessionState.editorDirty = false;
    editor.showModal();
    renderSaveStatus();
  }

  editorForm.onsubmit = async event => {
    event.preventDefault();
    if (sessionState.busy) return;
    // FormData nu e tipat ca iterabil fără lib „dom.iterable” (vezi tsconfig) — cast explicit.
    const formData = Object.fromEntries(
      /** @type {Iterable<[string, FormDataEntryValue]>} */ (
        /** @type {unknown} */ (new FormData(/** @type {HTMLFormElement} */ (event.currentTarget)))
      ),
    );
    const entry = /** @type {any} */ (sessionState.editor);
    const { type, mode, revision, record: previousRecord } = entry;
    editorSave.disabled = true;
    try {
      const context = buildContext(mode, previousRecord);
      const record = fieldsByType[type].read(formData, editorForm, context);
      if (record === null) return; // dublură neconfirmată
      await submitMutation('/api/record', { type, record, mode }, revision);
      editor.close();
      sessionState.editor = null;
    } catch (e) {
      const failure = /** @type {Error} */ (e);
      sessionState.saveError = failure.message;
      editorError.textContent = failure.message;
      showNotice(failure.message, true);
    } finally {
      editorSave.disabled = false;
      renderSaveStatus();
    }
  };

  /**
   * @param {EditableRecordType} type
   * @param {string} id
   */
  async function archiveRecord(type, id) {
    const record = /** @type {any[]} */ (readRecords()[type]).find(item => item.id === id);
    await submitMutation('/api/record', {
      type,
      mode: 'update',
      record: { ...record, archived: !record.archived, archivedAt: record.archived ? '' : new Date().toISOString() },
    });
  }

  /**
   * @param {EditableRecordType} type
   * @param {string} id
   */
  async function deleteRecord(type, id) {
    // Ireversibil, spre deosebire de archiveRecord() — doar pt. ce e deja arhivat.
    if (!window.confirm(`Ștergi definitiv înregistrarea ${id}? Nu poate fi anulată, spre deosebire de arhivare.`))
      return;
    await submitMutation('/api/record-delete', { type, id });
  }

  /** @param {string} paymentId */
  async function confirmReview(paymentId) {
    const record = readRecords().payments.find(item => item.id === paymentId);
    if (!record || record.reviewed) return;
    await submitMutation('/api/record', { type: 'payments', mode: 'update', record: { ...record, reviewed: true } });
    showNotice('Potrivirea automată a fost marcată ca verificată.');
  }

  return { openEditor, archiveRecord, deleteRecord, confirmReview };
}
