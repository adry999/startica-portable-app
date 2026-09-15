import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatAge } from '#shared/format/date-format.mjs';
import { textFieldMarkup, selectFieldMarkup, textareaFieldMarkup, formSectionMarkup } from '#shared/ui/form-fields.mjs';
import { copyToClipboard } from '#shared/ui/copy-to-clipboard.mjs';
import { allowedNextStatuses, applyVisitStatus, rescheduleVisit } from '../domain/visit-status.mjs';
import { parseVisitPasteTemplate, VISIT_PASTE_TEMPLATE } from '../domain/visit-paste-template.mjs';

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
  // Doar la creare: operatorul completează un șablon fix pe hârtie/telefon în timpul apelului,
  // apoi îl lipește aici în loc să retasteze fiecare câmp.
  const pasteTemplateSection =
    context.mode === 'create'
      ? `<div class="full paste-template"><button type="button" class="action-btn" id="vizPasteTemplate">Lipește din clipboard</button> <button type="button" class="action-btn" id="vizCopyTemplate">Copiază șablonul</button> <small class="field-hint">Datele trebuie scrise ca AAAA-LL-ZZ</small><p class="field-hint" id="vizPasteError" hidden></p></div>`
      : '';
  return (
    pasteTemplateSection +
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
        // La creare vizita nu poate porni decât „Programată” (vezi statusChoices mai sus) —
        // un select cu o singură opțiune forțată e doar zgomot vizual.
        (context.mode === 'create' ? '' : selectFieldMarkup('status', 'Statut', currentStatus, statusChoices)) +
        // Reprogramarea presupune o vizită deja existentă; la creare nu are ce reprograma.
        (context.mode === 'create' ? '' : '<p class="notice full">Schimbarea datei sau orei reprogramează vizita.</p>'),
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

// Scrie în formular câmpurile deja parsate din șablonul lipit. Separată de
// bind(), ca să poată fi testată direct, fără acces real la clipboard.
/**
 * @param {HTMLFormElement} formElement
 * @param {Record<string, string>} parsed
 */
export function applyParsedVisitFields(formElement, parsed) {
  for (const [field, value] of Object.entries(parsed)) {
    const control = /** @type {HTMLInputElement | HTMLSelectElement | null} */ (formElement.elements.namedItem(field));
    if (control) control.value = value;
  }
  if ('birthDate' in parsed) {
    const birthDateInput = /** @type {HTMLInputElement | null} */ (formElement.elements.namedItem('birthDate'));
    birthDateInput?.dispatchEvent(new Event('input'));
  }
}

/**
 * @param {HTMLFormElement} formElement
 * @param {any} context RecordEditorContext (din #features/record-editing, neimportat aici)
 */
function bind(formElement, context) {
  const birthDateInput = /** @type {HTMLInputElement} */ (formElement.elements.namedItem('birthDate'));
  const ageHint = formElement.querySelector('#vizAgeHint');
  if (birthDateInput && ageHint)
    birthDateInput.oninput = event =>
      (ageHint.textContent = 'Vârstă: ' + formatAge(/** @type {HTMLInputElement} */ (event.target).value));

  const pasteError = /** @type {HTMLElement | null} */ (formElement.querySelector('#vizPasteError'));
  // Element de feedback comun celor două butoane (lipit din/copiat în clipboard),
  // ca eroarea de citire și confirmarea de copiere să apară în același loc.
  const showPasteFeedback = (/** @type {string} */ message) => {
    if (!pasteError) return;
    pasteError.hidden = false;
    pasteError.textContent = message;
  };
  const clearPasteFeedback = () => {
    if (!pasteError) return;
    pasteError.hidden = true;
    pasteError.textContent = '';
  };

  const pasteButton = /** @type {HTMLButtonElement | null} */ (formElement.querySelector('#vizPasteTemplate'));
  if (pasteButton)
    pasteButton.onclick = async () => {
      try {
        const text = await navigator.clipboard.readText();
        applyParsedVisitFields(formElement, parseVisitPasteTemplate(text, { groups: context.records.groups }));
        clearPasteFeedback();
      } catch {
        showPasteFeedback('Nu am putut citi din clipboard. Completează câmpurile manual.');
      }
    };

  const copyButton = /** @type {HTMLButtonElement | null} */ (formElement.querySelector('#vizCopyTemplate'));
  if (copyButton) copyButton.onclick = () => copyToClipboard(VISIT_PASTE_TEMPLATE, 'Șablon copiat.', showPasteFeedback);
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
