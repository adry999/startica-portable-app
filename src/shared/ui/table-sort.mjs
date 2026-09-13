import { byId } from './element-lookup.mjs';

// Antetul acestor tabele e static în HTML: fiecare randare doar actualizează aria-sort, săgeata și click-ul.
const sortByTableId = {};

/**
 * @template Row
 * @param {string} tableId prefixul antetului `<tableId>Head`
 * @param {Row[]} rows
 * @param {Record<string, (row: Row) => unknown>} columns
 * @param {() => void} rerender
 * @returns {Row[]}
 */
export function sortTable(tableId, rows, columns, rerender) {
  const head = byId(`${tableId}Head`);
  const current = sortByTableId[tableId];
  if (head)
    for (const button of Array.from(
      /** @type {NodeListOf<HTMLButtonElement>} */ (head.querySelectorAll('[data-sort]')),
    )) {
      const active = current?.field === button.dataset.sort;
      button
        .closest('th')
        ?.setAttribute('aria-sort', active ? (current.direction === 'asc' ? 'ascending' : 'descending') : 'none');
      const arrow = button.querySelector('span');
      if (arrow) arrow.textContent = active ? (current.direction === 'asc' ? '↑' : '↓') : '↕';
      button.onclick = () => {
        sortByTableId[tableId] = {
          field: button.dataset.sort,
          direction: active && current.direction === 'asc' ? 'desc' : 'asc',
        };
        rerender();
      };
    }
  if (!current) return rows;
  const readValue = columns[current.field];
  if (!readValue) return rows;
  const factor = current.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const first = readValue(a),
      second = readValue(b);
    if (typeof first === 'number' || typeof second === 'number')
      return factor * ((Number(first) || 0) - (Number(second) || 0));
    return factor * String(first).localeCompare(String(second), 'ro', { numeric: true, sensitivity: 'base' });
  });
}
