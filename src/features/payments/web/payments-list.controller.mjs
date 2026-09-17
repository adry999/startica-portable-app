import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatDate, formatMonthLabel } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { total } from '#shared/domain/money.mjs';
import { allocations, paymentTenders } from '#shared/domain/payment-allocations.mjs';
import { childNameOf } from '#shared/domain/record-labels.mjs';
import { recordActions } from '#shared/ui/record-actions.mjs';
import { paginateRows, pageIndexByList } from '#shared/ui/pagination.mjs';
import { createBulkSelectionController, selectAllCheckboxMarkup } from '#shared/ui/bulk-selection.mjs';
import {
  listHeadMarkup,
  wireListSortHeaderClicks,
  applyManualSort,
  sortListRows,
  readListSortValue,
} from '#shared/ui/record-list-sort.mjs';
import { matchesRecordListSearch } from '#shared/ui/record-list-search.mjs';
import { formatPaymentTenders } from '#shared/format/payment-tenders-format.mjs';
import { summarizePaymentsByMethod } from '#shared/ui/record-list-summary.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Payment} Payment */

const LIST_ID = 'payments';
const HEADINGS = [
  selectAllCheckboxMarkup(LIST_ID),
  'Data',
  'Copil / sursă',
  'Total',
  'Luni acoperite',
  'Cash / Card / Transfer',
  'Acțiuni',
];
const SORT_FIELDS = [null, 'date', 'child', 'amount'];
const ALLOWED_SORT_FIELDS = /** @type {string[]} */ (SORT_FIELDS.filter(Boolean));

/**
 * Ecranul „Achitări”: căutare, filtre (copil, metodă, interval de luni,
 * arhivare), sortare pe coloane și arhivare/dezarhivare în masă.
 * @param {{
 *   elements: {
 *     search: HTMLInputElement,
 *     child: HTMLSelectElement,
 *     method: HTMLSelectElement,
 *     monthFrom: HTMLInputElement,
 *     monthTo: HTMLInputElement,
 *     archive: HTMLSelectElement,
 *     head: HTMLTableSectionElement,
 *     table: HTMLTableSectionElement,
 *     summaryText: HTMLElement,
 *     bulkButton: HTMLButtonElement,
 *   },
 *   readRecords: () => RecordsSnapshot,
 *   submitMutation: (path: string, body: unknown) => Promise<{ warning?: string }>,
 *   showNotice: (message: string, isError?: boolean) => void,
 * }} dependencies
 */
export function createPaymentsListController({
  elements: { search, child, method, monthFrom, monthTo, archive, head, table, summaryText, bulkButton },
  readRecords,
  submitMutation,
  showNotice,
}) {
  /** @type {import('#shared/ui/record-list-sort.mjs').ListSortState} */
  let sortState = { field: 'date', direction: 'desc', manual: false };

  const bulkSelection = createBulkSelectionController({
    recordType: 'payments',
    typeLabel: 'achitări',
    elements: { table, selectAllId: `${LIST_ID}SelectAll`, bulkButton, archiveFilter: archive },
    readRecords: () => readRecords().payments,
    submitMutation,
    showNotice,
  });

  // Selecția curentă se păstrează la re-randare, ca la filtrul de categorii.
  function renderChildFilterOptions() {
    const current = child.value;
    const names = [...readRecords().children].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
    child.innerHTML =
      '<option value="">Toți</option>' +
      names.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
    child.value = current;
  }

  /** @param {Payment} payment @param {RecordsSnapshot} records */
  function rowCellsFor(payment, records) {
    return [
      { cell: bulkSelection.rowCheckboxMarkupFor(payment.id) },
      { cell: formatDate(payment.date) },
      {
        cell:
          escapeHtml(childNameOf(payment, records.children)) + (payment.childId ? '' : '<br><small>Neasociată</small>'),
      },
      { cell: formatMoney(payment.amount), class: 'amount' },
      {
        cell:
          allocations(payment)
            .map(
              a => `<span class="money-line">${escapeHtml(formatMonthLabel(a.month))}: ${formatMoney(a.amount)}</span>`,
            )
            .join('<br>') || 'Avans nerepartizat',
      },
      { cell: formatPaymentTenders(payment) },
      { cell: recordActions('payments', payment) },
    ];
  }

  function renderRows() {
    const records = readRecords();
    const normalizedSearch = normalizeSearchText(search.value);
    const archiveValue = archive.value;
    const monthFromValue = monthFrom.value;
    const monthToValue = monthTo.value;
    const childIdValue = child.value;
    const methodValue = method.value;
    const rows = records.payments.filter(
      payment =>
        (archiveValue === 'all' || (archiveValue === 'archived' ? payment.archived : !payment.archived)) &&
        (!monthFromValue || payment.date.slice(0, 7) >= monthFromValue) &&
        (!monthToValue || payment.date.slice(0, 7) <= monthToValue) &&
        (!childIdValue || payment.childId === childIdValue) &&
        (!methodValue || paymentTenders(payment).some(tender => tender.method === methodValue)) &&
        matchesRecordListSearch(LIST_ID, payment, records, normalizedSearch),
    );
    // Textul e într-un <span> separat de buton, ca randarea repetată a
    // sumarului să nu șteargă butonul de arhivare/dezarhivare în masă.
    const byMethod = summarizePaymentsByMethod(rows);
    summaryText.innerHTML =
      `<strong>${rows.length}</strong> achitări · <strong>${formatMoney(total(rows))}</strong> total` +
      ` · Cash: ${formatMoney(byMethod.Cash)} · Card: ${formatMoney(byMethod.Card)} · Transfer: ${formatMoney(byMethod.Transfer)}` +
      (byMethod.Altele ? ` · Altele: ${formatMoney(byMethod.Altele)}` : '');
    sortListRows(rows, sortState, (field, row) => readListSortValue(field, row, records));
    head.innerHTML = listHeadMarkup(LIST_ID, HEADINGS, SORT_FIELDS, sortState);
    wireListSortHeaderClicks(head, (field, direction) => {
      sortState = applyManualSort(sortState, ALLOWED_SORT_FIELDS, field, direction);
      pageIndexByList[LIST_ID] = 0;
      renderRows();
    });
    table.innerHTML =
      /** @type {Payment[]} */ (paginateRows(LIST_ID, rows))
        .map(payment => {
          const cells = rowCellsFor(payment, records);
          return `<tr class="${payment.archived ? 'archived-row' : ''}">${cells
            .map(({ cell, class: cls }) => `<td${cls ? ` class="${cls}"` : ''}>${cell}</td>`)
            .join('')}</tr>`;
        })
        .join('') ||
      `<tr><td colspan="${HEADINGS.length}" class="empty">Nu există înregistrări pentru filtrele alese.</td></tr>`;
    bulkSelection.wireRowCheckboxes();
  }

  // Opțiunile filtrului de copil se refac doar la randarea completă, nu la fiecare tastare în filtre.
  function render() {
    renderRows();
    renderChildFilterOptions();
  }

  for (const input of [search, child, method, monthFrom, monthTo, archive])
    input.oninput = () => {
      pageIndexByList[LIST_ID] = 0;
      renderRows();
    };

  return { render };
}
