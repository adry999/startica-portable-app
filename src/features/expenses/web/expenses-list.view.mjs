import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { total } from '#shared/domain/money.mjs';
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

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Expense} Expense */

const LIST_ID = 'expenses';
const HEADINGS = [selectAllCheckboxMarkup(LIST_ID), 'Data', 'Categorie', 'Descriere', 'Suma', 'Acțiuni'];
const SORT_FIELDS = [null, 'date', 'category', 'description', 'amount'];
const ALLOWED_SORT_FIELDS = /** @type {string[]} */ (SORT_FIELDS.filter(Boolean));

/**
 * Ecranul „Cheltuieli”: căutare, filtre (interval de luni, categorie,
 * arhivare), sortare pe coloane și arhivare/dezarhivare în masă.
 * @param {{
 *   elements: {
 *     search: HTMLInputElement,
 *     monthFrom: HTMLInputElement,
 *     monthTo: HTMLInputElement,
 *     category: HTMLSelectElement,
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
export function createExpensesListView({
  elements: { search, monthFrom, monthTo, category, archive, head, table, summaryText, bulkButton },
  readRecords,
  submitMutation,
  showNotice,
}) {
  /** @type {import('#shared/ui/record-list-sort.mjs').ListSortState} */
  let sortState = { field: 'date', direction: 'desc', manual: false };

  const bulkSelection = createBulkSelectionController({
    recordType: 'expenses',
    typeLabel: 'cheltuieli',
    elements: { table, selectAllId: `${LIST_ID}SelectAll`, bulkButton, archiveFilter: archive },
    readRecords: () => readRecords().expenses,
    submitMutation,
    showNotice,
  });

  /** @param {Expense} expense */
  function rowCellsFor(expense) {
    return [
      bulkSelection.rowCheckboxMarkupFor(expense.id),
      formatDate(expense.date),
      escapeHtml(expense.category),
      escapeHtml(expense.description),
      formatMoney(expense.amount),
      recordActions('expenses', expense),
    ];
  }

  function render() {
    const records = readRecords();
    const normalizedSearch = normalizeSearchText(search.value);
    const archiveValue = archive.value;
    const monthFromValue = monthFrom.value;
    const monthToValue = monthTo.value;
    const categoryValue = category.value;
    const rows = records.expenses.filter(
      expense =>
        (archiveValue === 'all' || (archiveValue === 'archived' ? expense.archived : !expense.archived)) &&
        (!monthFromValue || expense.date.slice(0, 7) >= monthFromValue) &&
        (!monthToValue || expense.date.slice(0, 7) <= monthToValue) &&
        (!categoryValue || expense.category === categoryValue) &&
        matchesRecordListSearch(LIST_ID, expense, records, normalizedSearch),
    );
    summaryText.innerHTML = `<strong>${rows.length}</strong> cheltuieli · <strong>${formatMoney(total(rows))}</strong> total`;
    sortListRows(rows, sortState, (field, row) => readListSortValue(field, row, records));
    head.innerHTML = listHeadMarkup(LIST_ID, HEADINGS, SORT_FIELDS, sortState);
    wireListSortHeaderClicks(head, (field, direction) => {
      sortState = applyManualSort(sortState, ALLOWED_SORT_FIELDS, field, direction);
      pageIndexByList[LIST_ID] = 0;
      render();
    });
    table.innerHTML =
      /** @type {Expense[]} */ (paginateRows(LIST_ID, rows))
        .map(
          expense =>
            `<tr class="${expense.archived ? 'archived-row' : ''}">${rowCellsFor(expense)
              .map(cell => `<td>${cell}</td>`)
              .join('')}</tr>`,
        )
        .join('') ||
      `<tr><td colspan="${HEADINGS.length}" class="empty">Nu există înregistrări pentru filtrele alese.</td></tr>`;
    bulkSelection.wireRowCheckboxes();
  }

  for (const input of [search, monthFrom, monthTo, category, archive])
    input.oninput = () => {
      pageIndexByList[LIST_ID] = 0;
      render();
    };

  return { render };
}
