import { byId } from './element-lookup.mjs';

export const PAGE_SIZE = 100;
// Pagina curentă a fiecărei liste. Resetată când se schimbă filtrele.
export const pageIndexByList = { children: 0, payments: 0, expenses: 0, review: 0, status: 0 };

/**
 * @param {keyof typeof pageIndexByList} listId
 * @param {unknown[]} rows
 */
export function paginateRows(listId, rows) {
  const lastPage = Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1);
  const page = (pageIndexByList[listId] = Math.min(pageIndexByList[listId], lastPage));
  const pager = /** @type {HTMLElement | null} */ (byId(`${listId}Pager`));
  if (pager)
    pager.innerHTML =
      `<span>${rows.length} înregistrări · pagina ${page + 1}/${lastPage + 1}</span>` +
      `<button class="action-btn" data-page="${listId}" data-delta="-1" ${page === 0 ? 'disabled' : ''}>Înapoi</button>` +
      `<button class="action-btn" data-page="${listId}" data-delta="1" ${(page + 1) * PAGE_SIZE >= rows.length ? 'disabled' : ''}>Înainte</button>`;
  return rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
}
