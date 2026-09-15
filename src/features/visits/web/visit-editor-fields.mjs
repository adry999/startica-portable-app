import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatAge } from '#shared/format/date-format.mjs';
import { textFieldMarkup, selectFieldMarkup, textareaFieldMarkup, formSectionMarkup } from '#shared/ui/form-fields.mjs';
import { allowedNextStatuses, applyVisitStatus, rescheduleVisit } from '../domain/visit-status.mjs';

// Implementează structural RecordEditorFields din #features/record-editing —
// fără să îl importe, ca feature-urile să rămână izolate unele de altele.

/**
 * @param {any} record
 * @param {any} context RecordEditorContext (din #features/record-editing, neimportat aici)
 */
function markup(record, context) {
  const currentStatus = record.status || 'Programată';
  // La creare vizita nu poate porni decât „Programată”; „Înscris” nu apare
  // niciodată aici — îl pune doar ruta de înscriere.
  const statusChoices = context.mode === 'create' ? [] : allowedNextStatuses(currentStatus);
  const groupOptions = [...context.records.groups]
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    .map(
      g =>
        `<option value="${escapeHtml(g.id)}" ${g.id === record.desiredGroupId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`,
    )
    .join('');
  return (
    formSectionMarkup(
      'Copil',
      textFieldMarkup('name', 'Nume copil', record.name, 'text', 'required') +
        `<label class="field">Data nașterii<input name="birthDate" type="date" value="${escapeHtml(record.birthDate || '')}" id="vizBirthDate"><small class="field-hint" id="vizAgeHint">Vârstă: ${formatAge(record.birthDate)}</small></label>`,
    ) +
    formSectionMarkup(
      'Părinți',
      textFieldMarkup('parent', 'Părinte 1', record.parent, 'text', 'required') +
        textFieldMarkup('phone', 'Telefon părinte 1 (opțional)', record.phone, 'tel') +
        textFieldMarkup('parent2', 'Părinte 2 (opțional)', record.parent2) +
        textFieldMarkup('phone2', 'Telefon părinte 2 (opțional)', record.phone2, 'tel'),
    ) +
    formSectionMarkup(
      'Vizita',
      textFieldMarkup('date', 'Data vizitei', record.date || context.today(), 'date', 'required') +
        textFieldMarkup('time', 'Ora vizitei', record.time || '10:00', 'time', 'required') +
        selectFieldMarkup('status', 'Statut', currentStatus, statusChoices) +
        '<p class="notice full">Schimbarea datei sau orei reprogramează vizita.</p>',
    ) +
    formSectionMarkup(
      'Dorințe',
      textFieldMarkup('desiredStartDate', 'Data dorită de start', record.desiredStartDate, 'date') +
        `<label class="field">Grupa dorită<select name="desiredGroupId"><option value="">Fără grupă</option>${groupOptions}</select></label>` +
        textFieldMarkup('source', 'Cum a aflat de grădiniță', record.source),
    ) +
    formSectionMarkup(
      'Date medicale',
      textareaFieldMarkup('healthNotes', 'Date medicale', record.healthNotes) +
        '<p class="notice full">Date sensibile: nu apar în export și în istoric; se șterg automat la 12 luni de la ultima schimbare de statut.</p>',
    ) +
    formSectionMarkup(
      'După vizită',
      textareaFieldMarkup('postVisitNotes', 'Observații după vizită', record.postVisitNotes),
    )
  );
}

/**
 * @param {HTMLFormElement} formElement
 */
function bind(formElement) {
  const birthDateInput = /** @type {HTMLInputElement} */ (formElement.elements.namedItem('birthDate'));
  const ageHint = formElement.querySelector('#vizAgeHint');
  if (birthDateInput && ageHint)
    birthDateInput.oninput = event =>
      (ageHint.textContent = 'Vârstă: ' + formatAge(/** @type {HTMLInputElement} */ (event.target).value));
}

/**
 * @param {Record<string, FormDataEntryValue>} formData
 * @param {HTMLFormElement} formElement
 * @param {any} context RecordEditorContext (din #features/record-editing, neimportat aici)
 */
function read(formData, formElement, context) {
  const previous = context.previousRecord;
  const now = new Date().toISOString();
  let result = {
    ...previous,
    status: previous.status || 'Programată',
    history: previous.history || [],
    statusChangedAt: previous.statusChangedAt || now,
    notes: formData.notes,
    name: String(formData.name).trim(),
    birthDate: formData.birthDate,
    parent: String(formData.parent).trim(),
    phone: String(formData.phone).trim(),
    parent2: String(formData.parent2).trim(),
    phone2: String(formData.phone2).trim(),
    desiredStartDate: formData.desiredStartDate,
    desiredGroupId: formData.desiredGroupId || null,
    source: String(formData.source).trim(),
    healthNotes: formData.healthNotes,
    postVisitNotes: formData.postVisitNotes,
  };
  const date = String(formData.date);
  const time = String(formData.time);
  // Reprogramarea readuce statutul la „Programată” și scrie o intrare în
  // history; se aplică întâi, ca o schimbare simultană de statut din formular
  // să se aplice peste ea, nu să fie ștearsă de ea.
  result =
    date !== previous.date || time !== previous.time
      ? rescheduleVisit(result, { date, time }, now)
      : { ...result, date, time };
  const nextStatus = String(formData.status || result.status);
  if (nextStatus !== result.status) result = applyVisitStatus(result, nextStatus, now);
  return normalizeRecord('visits', result);
}

// Implementează structural RecordEditorFields (#features/record-editing/record-editing.types.mjs).
export const visitEditorFields = {
  idPrefix: 'VIZ',
  title: (record, mode) => (mode === 'update' ? 'Editează: ' : 'Adaugă: ') + 'vizită',
  markup,
  bind,
  read,
};
