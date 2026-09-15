import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatDate, formatAge } from '#shared/format/date-format.mjs';
import { formatParentContacts } from '#shared/format/parent-contacts-format.mjs';
import { groupNameOf } from '#shared/domain/record-labels.mjs';
import { recordActions } from '#shared/ui/record-actions.mjs';
import { listHeadMarkup, wireListSortHeaderClicks } from '#shared/ui/record-list-sort.mjs';
import { allowedNextStatuses } from '../domain/visit-status.mjs';
import { visitStatusBadgeClass } from './visit-labels.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Visit} Visit */
/** @typedef {import('#shared/ui/record-list-sort.mjs').ListSortState} ListSortState */

const LIST_ID = 'visits';
const HEADINGS = ['Data', 'Ora', 'Copil (vârstă)', 'Părinte / telefon', 'Statut', 'Grupa dorită', 'Acțiuni'];
const SORT_FIELDS = ['date', 'time', 'name', 'parent', 'status', 'group', null];

/** @param {Visit} visit */
function quickStatusButtonsMarkup(visit) {
  return allowedNextStatuses(visit.status)
    .map(
      status =>
        `<button type="button" class="action-btn" data-visit-action="${escapeHtml(status)}" data-id="${escapeHtml(visit.id)}">${escapeHtml(status)}</button>`,
    )
    .join('');
}

/** @param {Visit} visit */
function enrolButtonMarkup(visit) {
  return visit.status === 'Efectuată'
    ? `<button type="button" class="action-btn btn-primary" data-visit-action="enrol" data-id="${escapeHtml(visit.id)}">Înscrie copilul</button>`
    : '';
}

/**
 * @param {Visit} visit
 * @param {RecordsSnapshot} records
 */
function rowCellsFor(visit, records) {
  return [
    formatDate(visit.date),
    escapeHtml(visit.time),
    `${escapeHtml(visit.name)}<br><small>${escapeHtml(formatAge(visit.birthDate))}</small>`,
    // Vizita nu are `phone` obligatoriu ca fișa copilului; formatul e identic.
    formatParentContacts(/** @type {any} */ (visit)),
    `<span class="badge ${visitStatusBadgeClass(visit.status)}">${escapeHtml(visit.status)}</span>`,
    escapeHtml(groupNameOf(visit.desiredGroupId, records.groups) || '—'),
    `${recordActions('visits', visit)}${quickStatusButtonsMarkup(visit)}${enrolButtonMarkup(visit)}`,
  ];
}

/**
 * Lista ecranului „Vizite”: antet sortabil, rânduri cu acțiuni rapide de
 * statut și „Înscrie copilul”. Starea (filtre, lună, zi selectată) rămâne în
 * `visits.controller.mjs` — view-ul doar randează ce primește.
 * @param {{ elements: { head: HTMLTableSectionElement, table: HTMLTableSectionElement } }} dependencies
 */
export function createVisitsListView({ elements: { head, table } }) {
  /**
   * @param {{
   *   visits: Visit[],
   *   records: RecordsSnapshot,
   *   sortState: ListSortState,
   *   onSort: (field: string, direction: 'asc' | 'desc') => void,
   *   onQuickAction: (visitId: string, action: string) => void,
   * }} state
   */
  function render({ visits, records, sortState, onSort, onQuickAction }) {
    head.innerHTML = listHeadMarkup(LIST_ID, HEADINGS, SORT_FIELDS, sortState);
    wireListSortHeaderClicks(head, onSort);
    table.innerHTML =
      visits
        .map(
          visit =>
            `<tr class="${visit.archived ? 'archived-row' : ''}">${rowCellsFor(visit, records)
              .map(cell => `<td>${cell}</td>`)
              .join('')}</tr>`,
        )
        .join('') ||
      `<tr><td colspan="${HEADINGS.length}" class="empty">Nu există vizite pentru filtrele alese.</td></tr>`;
    table.onclick = event => {
      const button = /** @type {HTMLElement} */ (event.target).closest('[data-visit-action]');
      if (!button) return;
      onQuickAction(/** @type {any} */ (button).dataset.id, /** @type {any} */ (button).dataset.visitAction);
    };
  }
  return { render };
}
