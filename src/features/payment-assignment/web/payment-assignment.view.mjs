import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { allocations } from '#shared/domain/payment-allocations.mjs';
import { childPickerHTML, wireChildPicker } from '#shared/ui/child-picker.mjs';
import { sortTable } from '#shared/ui/table-sort.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {import('../payment-assignment.types.mjs').ChildSuggestion} ChildSuggestion */
/** @typedef {import('../payment-assignment.types.mjs').AssignmentQueueRow} AssignmentQueueRow */
/** @typedef {import('../payment-assignment.types.mjs').AssignmentRisk} AssignmentRisk */
/** @typedef {import('../payment-assignment.types.mjs').PaymentAssignmentScreenState} PaymentAssignmentScreenState */
/** @typedef {{ id: string, label: string, group: string }} ChildOption */

/** @type {Record<string, (row: AssignmentQueueRow) => unknown>} */
const SORT_COLUMNS = {
  date: row => row.payment.date,
  amount: row => Number(row.payment.amount) || 0,
  method: row => row.payment.method || '',
  source: row => row.payment.sourceName || row.payment.childName || '',
};

/** @param {ChildSuggestion} suggestion */
const suggestionLabel = suggestion => `${suggestion.name} — ${suggestion.reasons.join('; ')}`;

// Grupuri separate pentru că indiciile nu sunt la fel de tari: numele din sursă arată spre un copil anume,
// pe când suma sau luna neachitată se potrivesc la zeci de copii.
/**
 * @param {ChildSuggestion[]} suggestions
 * @param {Child[]} children
 * @returns {ChildOption[]}
 */
function childOptions(suggestions, children) {
  const suggestedIds = new Set(suggestions.map(suggestion => suggestion.id));
  return [
    ...suggestions
      .filter(suggestion => suggestion.nameMatch)
      .map(suggestion => ({ id: suggestion.id, label: suggestionLabel(suggestion), group: 'Nume potrivit în sursă' })),
    ...suggestions
      .filter(suggestion => !suggestion.nameMatch)
      .map(suggestion => ({
        id: suggestion.id,
        label: suggestionLabel(suggestion),
        group: 'Doar sumă sau lună — verifică',
      })),
    ...children
      .filter(child => !child.archived && !suggestedIds.has(child.id))
      .sort((first, second) => first.name.localeCompare(second.name, 'ro'))
      .map(child => ({ id: child.id, label: child.name, group: 'Toți copiii' })),
  ];
}

/**
 * @param {AssignmentRisk} risk
 * @param {string} month
 */
function riskMarkup(risk, month) {
  return (
    `<article class="card pink"><p>Achitări fără copil</p><strong>${risk.unassigned}</strong><small>nu se scad din datoria nimănui</small></article>` +
    `<article class="card yellow"><p>Din care pe luna ${escapeHtml(month)}</p><strong>${risk.coveringMonth}</strong><small>${formatMoney(risk.amountCoveringMonth)}</small></article>` +
    `<article class="card orange"><p>Copii pe lista de notificat</p><strong>${risk.notified}</strong><small>unii pot să fi achitat deja</small></article>`
  );
}

// Defalcarea se face pe lotul afișat: sugestiile pentru toate achitările neasociate ar încetini interfața.
/** @param {PaymentAssignmentScreenState} state */
function queueSummary({ risk, queue }) {
  if (!risk.unassigned) return 'Toate achitările au un copil asociat.';
  const nameMatchCounts = queue.map(row => row.suggestions.filter(suggestion => suggestion.nameMatch).length);
  const unique = nameMatchCounts.filter(count => count === 1).length;
  const ambiguous = nameMatchCounts.filter(count => count > 1).length;
  return (
    `Se afișează cele mai recente ${queue.length} din ${risk.unassigned}. ` +
    `Din ele: ${unique} cu un singur nume potrivit, ${ambiguous} cu mai mulți candidați, ` +
    `${queue.length - unique - ambiguous} fără niciun nume în sursă — acelea cer documentul original.`
  );
}

/**
 * @param {AssignmentQueueRow} row
 * @param {string} selectedLabel
 */
function rowMarkup({ payment, selectedChildId }, selectedLabel) {
  const months =
    allocations(payment)
      .map(allocation => `${escapeHtml(allocation.month)}: ${formatMoney(allocation.amount)}`)
      .join('<br>') || '—';
  const source = payment.sourceName || payment.childName || '';
  return (
    `<tr data-payment="${escapeHtml(payment.id)}"><td>${formatDate(payment.date)}</td><td><strong>${formatMoney(payment.amount)}</strong></td>` +
    `<td>${escapeHtml(payment.method || '')}</td><td>${months}</td>` +
    `<td>${source ? escapeHtml(source) : '<small>fără text în sursă</small>'}</td>` +
    `<td>${childPickerHTML({ name: '', placeholder: '— alege copilul —', selectedId: selectedChildId, selectedLabel })}</td></tr>`
  );
}

/**
 * @param {{
 *   elements: {
 *     risk: HTMLElement,
 *     summary: HTMLElement,
 *     tableBody: HTMLElement,
 *     saveButton: HTMLButtonElement,
 *     failure: HTMLElement,
 *   },
 *   readChildren: () => Child[],
 *   readSelectedMonth: () => string,
 *   onSelectChild: (paymentId: string, childId: string) => void,
 * }} dependencies
 * @returns {(state: PaymentAssignmentScreenState) => void}
 */
export function createPaymentAssignmentView({ elements, readChildren, readSelectedMonth, onSelectChild }) {
  /** @type {ChildSuggestion[][] | null} */
  let renderedSuggestions = null;
  /** @type {PaymentAssignmentScreenState | null} */
  let lastState = null;
  /** @type {Map<string, { search: HTMLInputElement, value: HTMLInputElement, options: ChildOption[] }>} */
  let pickersByPaymentId = new Map();

  /** @param {ChildOption[]} options @param {string} childId */
  const labelOf = (options, childId) => options.find(option => option.id === childId)?.label ?? '';

  /** @param {PaymentAssignmentScreenState} state */
  function renderTable(state) {
    const rows = sortTable('assign', state.queue, SORT_COLUMNS, () => {
      renderedSuggestions = null;
      if (lastState) renderAssignmentScreen(lastState);
    });
    const children = readChildren();
    const optionsByPaymentId = new Map(rows.map(row => [row.payment.id, childOptions(row.suggestions, children)]));
    elements.tableBody.innerHTML =
      rows
        .map(row => rowMarkup(row, labelOf(optionsByPaymentId.get(row.payment.id) ?? [], row.selectedChildId)))
        .join('') || '<tr><td colspan="6" class="empty">Nu există achitări neasociate.</td></tr>';

    pickersByPaymentId = new Map();
    for (const tableRow of Array.from(
      /** @type {NodeListOf<HTMLTableRowElement>} */ (elements.tableBody.querySelectorAll('tr[data-payment]')),
    )) {
      const paymentId = tableRow.dataset.payment ?? '';
      const picker = /** @type {HTMLElement} */ (tableRow.querySelector('[data-child-picker]'));
      const options = optionsByPaymentId.get(paymentId) ?? [];
      pickersByPaymentId.set(paymentId, {
        search: /** @type {HTMLInputElement} */ (picker.querySelector('.child-picker-input')),
        value: /** @type {HTMLInputElement} */ (picker.querySelector('.child-picker-value')),
        options,
      });
      wireChildPicker(picker, options, childId => onSelectChild(paymentId, childId));
    }
    renderedSuggestions = state.queue.map(row => row.suggestions);
  }

  // Selecțiile se schimbă des (completare, golire); tabelul se reconstruiește doar când se schimbă coada.
  /** @param {PaymentAssignmentScreenState} state */
  function syncSelections(state) {
    for (const row of state.queue) {
      const picker = pickersByPaymentId.get(row.payment.id);
      if (!picker || picker.value.value === row.selectedChildId) continue;
      picker.value.value = row.selectedChildId;
      picker.search.value = labelOf(picker.options, row.selectedChildId);
    }
  }

  /** @param {PaymentAssignmentScreenState} state */
  function renderAssignmentScreen(state) {
    lastState = state;
    elements.risk.innerHTML = riskMarkup(state.risk, readSelectedMonth());
    elements.summary.textContent = queueSummary(state);
    const queueChanged =
      !renderedSuggestions ||
      renderedSuggestions.length !== state.queue.length ||
      state.queue.some((row, index) => row.suggestions !== renderedSuggestions?.[index]);
    if (queueChanged) renderTable(state);
    else syncSelections(state);
    elements.saveButton.disabled = state.isSaving;
    elements.failure.textContent = state.failure?.message ?? '';
  }

  return renderAssignmentScreen;
}
