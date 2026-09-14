import { escapeHtml } from '#shared/format/html-escape.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { dueDayFor } from '#shared/domain/tuition-obligation.mjs';
import { contractNumberOf, groupNameOf } from '#shared/domain/record-labels.mjs';
import { recordActionButton, recordActions } from '#shared/ui/record-actions.mjs';
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
import { formatParentContacts } from '#shared/format/parent-contacts-format.mjs';
import { statusBadgeClass } from './child-labels.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */

const LIST_ID = 'children';
// Prima coloană e caseta „selectează tot”, generată de bulk-selection.mjs.
const HEADINGS = [
  selectAllCheckboxMarkup(LIST_ID),
  'Contract',
  'Copil',
  'Părinți / telefoane',
  'Grupă',
  'Scadență',
  'Statut',
  'Acțiuni',
];
const SORT_FIELDS = [null, 'contract', 'name', null, 'group', 'dueDay', 'status'];
const ALLOWED_SORT_FIELDS = /** @type {string[]} */ (SORT_FIELDS.filter(Boolean));

/**
 * Ecranul „Copii”: căutare, filtru de arhivare, sortare pe coloane și
 * arhivare/dezarhivare în masă.
 * @param {{
 *   elements: {
 *     search: HTMLInputElement,
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
export function createChildrenListView({
  elements: { search, archive, head, table, summaryText, bulkButton },
  readRecords,
  submitMutation,
  showNotice,
}) {
  /** @type {import('#shared/ui/record-list-sort.mjs').ListSortState} */
  let sortState = { field: 'name', direction: 'asc', manual: false };

  const bulkSelection = createBulkSelectionController({
    recordType: 'children',
    typeLabel: 'copii',
    elements: { table, selectAllId: `${LIST_ID}SelectAll`, bulkButton, archiveFilter: archive },
    readRecords: () => readRecords().children,
    submitMutation,
    showNotice,
  });

  /** @param {Child} child */
  function rowCellsFor(child) {
    const records = readRecords();
    return [
      bulkSelection.rowCheckboxMarkupFor(child.id),
      escapeHtml(contractNumberOf(child)),
      recordActionButton('profile', 'children', child.id, child.name),
      formatParentContacts(child),
      escapeHtml(groupNameOf(child.groupId, records.groups) || 'Lipsește'),
      `ziua ${dueDayFor(child)}`,
      `<span class="badge ${statusBadgeClass(child.status)}">${escapeHtml(child.status)}${child.archived ? ' · Arhivat' : ''}</span>`,
      recordActions('children', child),
    ];
  }

  function render() {
    const records = readRecords();
    const normalizedSearch = normalizeSearchText(search.value);
    const archiveValue = archive.value;
    const rows = records.children.filter(
      child =>
        (archiveValue === 'all' || (archiveValue === 'archived' ? child.archived : !child.archived)) &&
        matchesRecordListSearch(LIST_ID, child, records, normalizedSearch),
    );
    summaryText.innerHTML = `<strong>${rows.length}</strong> copii`;
    sortListRows(rows, sortState, (field, row) => readListSortValue(field, row, records));
    head.innerHTML = listHeadMarkup(LIST_ID, HEADINGS, SORT_FIELDS, sortState);
    wireListSortHeaderClicks(head, (field, direction) => {
      sortState = applyManualSort(sortState, ALLOWED_SORT_FIELDS, field, direction);
      pageIndexByList[LIST_ID] = 0;
      render();
    });
    table.innerHTML =
      /** @type {Child[]} */ (paginateRows(LIST_ID, rows))
        .map(
          child =>
            `<tr class="${child.archived ? 'archived-row' : ''}">${rowCellsFor(child)
              .map(cell => `<td>${cell}</td>`)
              .join('')}</tr>`,
        )
        .join('') ||
      `<tr><td colspan="${HEADINGS.length}" class="empty">Nu există înregistrări pentru filtrele alese.</td></tr>`;
    bulkSelection.wireRowCheckboxes();
  }

  for (const input of [search, archive])
    input.oninput = () => {
      pageIndexByList[LIST_ID] = 0;
      render();
    };

  return { render };
}
