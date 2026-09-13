import { childNameOf, groupNameOf } from '#shared/domain/record-labels.mjs';
import { dueDayFor } from '#shared/domain/tuition-obligation.mjs';

/** @typedef {{ field: string | null, direction: 'asc' | 'desc', manual: boolean }} ListSortState */

// Antetul unei liste cu coloane generate (Copii, Achitări, Cheltuieli), spre
// deosebire de #shared/ui/table-sort.mjs, care servește antete statice din HTML.
/**
 * @param {string} listId
 * @param {string[]} headings
 * @param {(string | null)[]} sortFields index cu aceeași lungime ca `headings`; null = coloană fără sortare
 * @param {ListSortState} sortState
 */
export function listHeadMarkup(listId, headings, sortFields, sortState) {
  const { field: activeField, direction, manual } = sortState;
  return (
    '<tr>' +
    headings
      .map((label, index) => {
        const field = sortFields[index];
        if (!field) return `<th>${label}</th>`;
        const active = field === activeField && manual;
        const arrow = active ? (direction === 'asc' ? '↑' : '↓') : '↕';
        const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none';
        return `<th aria-sort="${ariaSort}"><button type="button" class="table-sort" data-sort-type="${listId}" data-sort="${field}">${label}<span aria-hidden="true">${arrow}</span></button></th>`;
      })
      .join('') +
    '</tr>'
  );
}

/**
 * @param {HTMLElement} headElement
 * @param {(field: string, direction: 'asc' | 'desc') => void} onSort
 */
export function wireListSortHeaderClicks(headElement, onSort) {
  for (const sortButton of Array.from(
    /** @type {NodeListOf<HTMLButtonElement>} */ (headElement.querySelectorAll('[data-sort]')),
  ))
    sortButton.onclick = () =>
      onSort(
        sortButton.dataset.sort ?? '',
        sortButton.parentElement?.getAttribute('aria-sort') === 'ascending' ? 'desc' : 'asc',
      );
}

/**
 * @param {ListSortState} currentState
 * @param {string[]} allowedFields
 * @param {string} field
 * @param {'asc' | 'desc'} direction
 * @returns {ListSortState}
 */
export function applyManualSort(currentState, allowedFields, field, direction) {
  if (!allowedFields.includes(field)) return currentState;
  return { field, direction, manual: true };
}

// Valoarea de sortat pentru o coloană a unei liste. Numele câmpului identifică
// unic coloana — nu contează pe ce listă (Copii/Achitări/Cheltuieli) apare —
// de aceea funcția nu ia tipul listei ca parametru.
/**
 * @param {string} field
 * @param {any} row
 * @param {{ children: import('#shared/contracts/record-types.mjs').Child[], groups: import('#shared/contracts/record-types.mjs').Group[] }} records
 */
export function readListSortValue(field, row, records) {
  if (field === 'contract') return row.contractNumber || row.id;
  if (field === 'name') return row.name;
  if (field === 'child') return childNameOf(row, records.children);
  if (field === 'amount') return Number(row.amount) || 0;
  if (field === 'group') return groupNameOf(row.groupId, records.groups);
  if (field === 'dueDay') return dueDayFor(row);
  return row[field] || '';
}

/**
 * @template Row
 * @param {Row[]} rows
 * @param {ListSortState} sortState
 * @param {(field: string, row: Row) => unknown} readSortValue
 * @returns {Row[]} același array, sortat pe loc (ca la sortarea unei liste filtrate proaspăt)
 */
export function sortListRows(rows, sortState, readSortValue) {
  const { field, direction } = sortState;
  const factor = direction === 'asc' ? 1 : -1;
  return rows.sort((a, b) => {
    const first = readSortValue(field ?? '', a);
    const second = readSortValue(field ?? '', b);
    if (typeof first === 'number' || typeof second === 'number') return factor * (Number(first) - Number(second));
    return factor * String(first).localeCompare(String(second), 'ro', { numeric: true, sensitivity: 'base' });
  });
}
