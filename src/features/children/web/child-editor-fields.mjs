import { normalizeRecord, CHILD_STATUSES, STATUS_HISTORY_VALUES } from '#shared/domain/record-schema.mjs';
import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatAge } from '#shared/format/date-format.mjs';
import { textFieldMarkup, selectFieldMarkup, textareaFieldMarkup, formSectionMarkup } from '#shared/ui/form-fields.mjs';

// Implementează structural RecordEditorFields din #features/record-editing —
// fără să îl importe, ca feature-urile să rămână izolate unele de altele.

function parseHistory(value, key) {
  return value
    .split('\n')
    .filter(s => s.trim())
    .map(s => {
      const parts = s.split('=');
      if (parts.length !== 2) throw Error('Istoric invalid. Folosește formatul lună = valoare.');
      return { from: parts[0].trim(), [key]: key === 'amount' ? Number(parts[1].trim()) : parts[1].trim() };
    });
}

const upsertHistory = (rows, from, key, value) => [...rows.filter(r => r.from !== from), { from, [key]: value }];

/**
 * @param {any} record
 * @param {any} context RecordEditorContext (din #features/record-editing, neimportat aici)
 */
function markup(record, context) {
  const groupOptions = [...context.records.groups]
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    .map(
      g =>
        `<option value="${escapeHtml(g.id)}" ${g.id === record.groupId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`,
    )
    .join('');
  const currentMonth = context.today().slice(0, 7);
  return (
    formSectionMarkup(
      'Date copil',
      textFieldMarkup('name', 'Nume copil', record.name, 'text', 'required') +
        `<label class="field">Data nașterii<input name="birthDate" type="date" value="${escapeHtml(record.birthDate)}" id="childBirthDate"><small class="field-hint" id="childAgeHint">Vârstă: ${formatAge(record.birthDate)}</small></label>` +
        selectFieldMarkup('status', 'Statut', record.status || 'Activ', CHILD_STATUSES) +
        `<label class="field">Grupă<select name="groupId"><option value="">Fără grupă</option>${groupOptions}</select></label>`,
    ) +
    formSectionMarkup(
      'Părinți',
      textFieldMarkup('parent', 'Părinte 1', record.parent, 'text', 'required') +
        textFieldMarkup('phone', 'Telefon părinte 1 (opțional)', record.phone, 'tel') +
        textFieldMarkup('parent2', 'Părinte 2 (opțional)', record.parent2) +
        textFieldMarkup('phone2', 'Telefon părinte 2 (opțional)', record.phone2, 'tel'),
    ) +
    formSectionMarkup(
      'Contract și taxe',
      textFieldMarkup('contractDate', 'Data contractului', record.contractDate, 'date') +
        textFieldMarkup('attendanceDate', 'Început frecventare', record.attendanceDate, 'date') +
        textFieldMarkup('withdrawalDate', 'Retragere', record.withdrawalDate, 'date') +
        textFieldMarkup('statusFrom', 'Statut aplicabil din luna', currentMonth, 'month', 'required') +
        textFieldMarkup('fee', 'Taxa lunară (gol = necunoscută)', record.fee ?? '', 'number', 'min="0" step="0.01"') +
        textFieldMarkup('feeFrom', 'Taxa aplicabilă din luna', currentMonth, 'month') +
        textFieldMarkup('dueDay', 'Ziua scadenței', record.dueDay || 10, 'number', 'min="1" max="31" required'),
    ) +
    formSectionMarkup(
      'Istoric (avansat)',
      textareaFieldMarkup(
        'feeHistory',
        'Istoric taxe — câte un rând: 2026-09 = 2000',
        (record.feeHistory || []).map(f => `${f.from} = ${f.amount}`).join('\n'),
      ) +
        textareaFieldMarkup(
          'statusHistory',
          'Istoric statut — câte un rând: 2026-09 = Activ',
          (record.statusHistory || []).map(f => `${f.from} = ${f.status}`).join('\n'),
        ) +
        '<p class="notice full">Taxele se aplică integral lunii începute. O taxă sau un statut schimbat adaugă o intrare din luna aleasă. Poți corecta explicit rândurile din istoric. Completează data începerii pentru calculul obligațiilor.</p>',
    )
  );
}

/**
 * @param {HTMLFormElement} formElement
 * @param {any} context RecordEditorContext (din #features/record-editing, neimportat aici)
 */
function bind(formElement, context) {
  const birthDateInput = /** @type {HTMLInputElement} */ (formElement.elements.namedItem('birthDate'));
  const ageHint = formElement.querySelector('#childAgeHint');
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
  const record = {
    ...previous,
    notes: formData.notes,
    name: String(formData.name).trim(),
    parent: String(formData.parent).trim(),
    phone: String(formData.phone).trim(),
    parent2: String(formData.parent2).trim(),
    phone2: String(formData.phone2).trim(),
    groupId: formData.groupId || null,
    birthDate: formData.birthDate,
    contractDate: formData.contractDate,
    attendanceDate: formData.attendanceDate,
    withdrawalDate: formData.withdrawalDate,
    status: formData.status,
    fee: formData.fee === '' ? null : Number(formData.fee),
    dueDay: Number(formData.dueDay),
    feeHistory: parseHistory(String(formData.feeHistory), 'amount'),
    statusHistory: parseHistory(String(formData.statusHistory), 'status'),
  };
  // O taxă sau un statut schimbat adaugă o intrare din luna aleasă, ca lunile
  // trecute să păstreze valoarea de atunci.
  if (record.fee !== null && formData.feeFrom && (!record.feeHistory.length || record.fee !== previous.fee))
    record.feeHistory = upsertHistory(record.feeHistory, formData.feeFrom, 'amount', record.fee);
  if (!record.statusHistory.length && (previous.status || record.status) === 'Activ' && record.attendanceDate)
    record.statusHistory = [{ from: String(record.attendanceDate).slice(0, 7), status: 'Activ' }];
  if (
    STATUS_HISTORY_VALUES.includes(record.status) &&
    (!record.statusHistory.length || record.status !== (previous.status || 'Activ'))
  )
    record.statusHistory = upsertHistory(record.statusHistory, formData.statusFrom, 'status', record.status);
  return normalizeRecord('children', record);
}

// Implementează structural RecordEditorFields (#features/record-editing/record-editing.types.mjs).
export const childEditorFields = {
  idPrefix: 'ID',
  title: (record, mode) => (mode === 'update' ? 'Editează: ' : 'Adaugă: ') + 'copil',
  markup,
  bind,
  read,
};
