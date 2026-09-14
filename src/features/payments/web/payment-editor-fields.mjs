import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { cents } from '#shared/domain/money.mjs';
import { allocations, paymentTenders } from '#shared/domain/payment-allocations.mjs';
import { firstUnpaidMonth } from '#shared/domain/tuition-obligation.mjs';
import { escapeHtml } from '#shared/format/html-escape.mjs';
import { textFieldMarkup, formSectionMarkup } from '#shared/ui/form-fields.mjs';
import { childPickerHTML, wireChildPicker } from '#shared/ui/child-picker.mjs';
import { addAllocationRow, readAllocationRows, renderAllocationBalance } from './allocation-rows.mjs';

// Implementează structural RecordEditorFields, fără să importe record-editing,
// ca feature-urile să rămână izolate.

/** @param {HTMLFormElement} formElement */
function readTenders(formElement) {
  return Array.from(formElement.querySelectorAll('[data-tender]'))
    .map(input => ({
      method: /** @type {HTMLElement} */ (input).dataset.tender,
      amount: Number(/** @type {HTMLInputElement} */ (input).value),
    }))
    .filter(p => p.amount !== 0);
}

/**
 * @param {any} record
 * @param {any} context RecordEditorContext (din #features/record-editing, neimportat aici)
 */
function markup(record, context) {
  const selectedChild = context.records.children.find(c => c.id === record.childId);
  const currentLabel = selectedChild ? selectedChild.name + (selectedChild.archived ? ' (arhivat)' : '') : '';
  const methods = [...new Set(['Cash', 'Card', 'Transfer', ...paymentTenders(record).map(p => p.method)])]
    .map(method =>
      textFieldMarkup(
        'tender' + method,
        method,
        paymentTenders(record).find(p => p.method === method)?.amount || '',
        'number',
        `min="0" step="0.01" data-tender="${escapeHtml(method)}"`,
      ),
    )
    .join('');
  return (
    formSectionMarkup(
      'Copil și dată',
      `<label class="field full">Copil` +
        childPickerHTML({ name: 'childId', selectedId: record.childId || '', selectedLabel: currentLabel }) +
        `</label>` +
        textFieldMarkup('date', 'Data încasării', record.date || context.today(), 'date', 'required'),
    ) +
    formSectionMarkup(
      'Sumă și metodă',
      textFieldMarkup(
        'amount',
        'Total achitare (calculat automat)',
        record.amount ?? 0,
        'number',
        'readonly step="0.01"',
      ) +
        `<div class="full tender-fields"><p>Completează una sau mai multe metode. Totalul se calculează automat; repartizarea pe luni folosește acest total o singură dată.</p>${methods}</div>` +
        textFieldMarkup('sourceName', 'Nume din sursă / plătitor', record.sourceName || record.childName || ''),
    ) +
    formSectionMarkup(
      'Repartizare pe luni',
      `<div class="full"><p>Suma rămasă nerepartizată este evidențiată ca avans.</p><div id="allocationRows"></div><button type="button" class="action-btn" id="addAllocation">+ Lună</button><p id="allocationBalance"></p></div>`,
    ) +
    (record.verification
      ? formSectionMarkup(
          'Verificare import',
          `<label class="field full checkbox-field"><input name="reviewed" type="checkbox" ${record.reviewed ? 'checked' : ''}><span>Am verificat observațiile importului</span></label>` +
            `<p class="full field-hint">${escapeHtml(record.verification)}</p>`,
        )
      : '')
  );
}

/**
 * @param {HTMLFormElement} formElement
 * @param {any} context RecordEditorContext (din #features/record-editing, neimportat aici)
 */
function bind(formElement, context) {
  const record = context.previousRecord;
  const elements = {
    formElement,
    rowsContainer: /** @type {HTMLElement} */ (formElement.querySelector('#allocationRows')),
    balanceElement: /** @type {HTMLElement} */ (formElement.querySelector('#allocationBalance')),
  };
  for (const allocation of allocations(record)) addAllocationRow(elements, allocation, context);
  if (context.mode === 'create')
    addAllocationRow(elements, { month: (record.date || context.today()).slice(0, 7), amount: '' }, context);

  const dateInput = /** @type {HTMLInputElement} */ (formElement.elements.namedItem('date'));
  // Luna repartizării urmărește data încasării cât timp rândul unic de
  // repartizare mai e încă egal cu ce am pornit — la prima editare manuală,
  // sau dacă era deja diferit (plată pt. altă lună), sincronizarea nu pornește.
  let syncedMonth = dateInput.value.slice(0, 7);
  dateInput.oninput = event => {
    const rows = elements.rowsContainer.children;
    const monthInput =
      rows.length === 1 ? /** @type {HTMLInputElement} */ (rows[0].querySelector('[data-month]')) : null;
    if (monthInput && monthInput.value === syncedMonth) {
      syncedMonth = /** @type {HTMLInputElement} */ (event.target).value.slice(0, 7);
      monthInput.value = syncedMonth;
      renderAllocationBalance(elements, context);
    }
  };
  /** @type {HTMLButtonElement} */ (formElement.querySelector('#addAllocation')).onclick = () =>
    addAllocationRow(elements, { month: '', amount: '' }, context);

  const singleAmountInput = () => {
    const rows = elements.rowsContainer.children;
    return rows.length === 1 ? /** @type {HTMLInputElement} */ (rows[0].querySelector('[data-amount]')) : null;
  };
  let syncedAmount = singleAmountInput()?.value || '';
  // Suma repartizată urmărește totalul calculat din metode, cu aceeași
  // protecție ca la lună: rămâne legată doar cât timp n-a fost atinsă manual.
  const updatePaymentTotal = () => {
    const totalValue = readTenders(formElement).reduce((sum, tender) => sum + cents(tender.amount), 0) / 100;
    /** @type {HTMLInputElement} */ (formElement.elements.namedItem('amount')).value = totalValue.toFixed(2);
    const amountInput = singleAmountInput();
    if (amountInput && (amountInput.value === syncedAmount || amountInput.value === '')) {
      syncedAmount = totalValue ? totalValue.toFixed(2) : '';
      amountInput.value = syncedAmount;
    }
    renderAllocationBalance(elements, context);
  };
  for (const input of Array.from(formElement.querySelectorAll('[data-tender]')))
    /** @type {HTMLInputElement} */ (input).oninput = updatePaymentTotal;
  updatePaymentTotal();

  const options = [
    { id: '', label: 'Copil neasociat' },
    ...context.records.children.map(child => ({
      id: child.id,
      label: child.name + (child.archived ? ' (arhivat)' : ''),
    })),
  ];
  const pickerElement = formElement.querySelector('[data-child-picker]');
  if (pickerElement)
    // Alegerea copilului propune luna cea mai veche neachitată a lui, nu luna
    // încasării: încasarea vine des într-o lună pt. taxa lunii precedente.
    wireChildPicker(pickerElement, options, childId => {
      const rows = elements.rowsContainer.children;
      const monthInput =
        rows.length === 1 ? /** @type {HTMLInputElement} */ (rows[0].querySelector('[data-month]')) : null;
      if (!monthInput || monthInput.value !== syncedMonth) return;
      const child = context.records.children.find(c => c.id === childId);
      const suggested = child && firstUnpaidMonth(child, context.records.payments);
      if (suggested && suggested !== syncedMonth) {
        syncedMonth = suggested;
        monthInput.value = suggested;
        renderAllocationBalance(elements, context);
      }
    });
}

/**
 * @param {Record<string, FormDataEntryValue>} formData
 * @param {HTMLFormElement} formElement
 * @param {any} context RecordEditorContext (din #features/record-editing, neimportat aici)
 */
function read(formData, formElement, context) {
  const record = normalizeRecord('payments', {
    ...context.previousRecord,
    notes: formData.notes,
    childId: formData.childId,
    date: formData.date,
    // Totalul se recalculează din metode; valoarea din câmp e doar afișaj.
    amount: undefined,
    tenders: readTenders(formElement),
    sourceName: formData.sourceName,
    reviewed: formData.reviewed === 'on',
    allocations: readAllocationRows(/** @type {HTMLElement} */ (formElement.querySelector('#allocationRows'))),
  });
  const duplicate = context.records.payments.some(
    p =>
      !p.archived &&
      p.childId === record.childId &&
      p.date === record.date &&
      cents(p.amount) === cents(record.amount) &&
      p.method === record.method,
  );
  if (
    context.mode === 'create' &&
    duplicate &&
    !context.confirm(
      'Există o plată cu același copil, aceeași dată, sumă și metodă. Confirmi că este o plată distinctă?',
    )
  )
    return null;
  return record;
}

export const paymentEditorFields = {
  idPrefix: 'PAY',
  title: (record, mode) => (mode === 'update' ? 'Editează: ' : 'Adaugă: ') + 'achitare',
  markup,
  bind,
  read,
};
