import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { escapeHtml } from '#shared/format/html-escape.mjs';
import { textFieldMarkup } from '#shared/ui/form-fields.mjs';

// Port 1:1 al fostului web/ui/editor.mjs (expenseFields, expenseFromForm).
// Implementează structural RecordEditorFields (#features/record-editing/record-editing.types.mjs).
// Sugestiile de categorie vin din context.readExpenseCategoryNames(), injectat
// de compunerea din web/app.js — modulul nu importă alt feature.

/**
 * @param {any} record
 * @param {any} context RecordEditorContext (din #features/record-editing, neimportat aici)
 */
function markup(record, context) {
  const categories = context.readExpenseCategoryNames();
  return (
    textFieldMarkup('date', 'Data cheltuielii', record.date || context.today(), 'date', 'required') +
    textFieldMarkup('amount', 'Suma', record.amount ?? '', 'number', 'required min="0.01" step="0.01"') +
    textFieldMarkup(
      'category',
      'Categorie',
      record.category || 'Altele',
      'text',
      'required list="expenseCategoryOptions"',
    ) +
    `<datalist id="expenseCategoryOptions">${categories.map(c => `<option value="${escapeHtml(c)}"></option>`).join('')}</datalist>` +
    textFieldMarkup('description', 'Descriere', record.description)
  );
}

/**
 * @param {Record<string, FormDataEntryValue>} formData
 * @param {HTMLFormElement} formElement
 * @param {any} context RecordEditorContext (din #features/record-editing, neimportat aici)
 */
function read(formData, formElement, context) {
  return normalizeRecord('expenses', {
    ...context.previousRecord,
    notes: formData.notes,
    date: formData.date,
    amount: Number(formData.amount),
    category: String(formData.category).trim(),
    description: String(formData.description).trim(),
  });
}

export const expenseEditorFields = {
  idPrefix: 'EXP',
  title: (record, mode) => (mode === 'update' ? 'Editează: ' : 'Adaugă: ') + 'cheltuială',
  markup,
  read,
};
