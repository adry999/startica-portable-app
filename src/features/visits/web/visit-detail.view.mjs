import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatAge, formatDate } from '#shared/format/date-format.mjs';
import { formatParentContacts } from '#shared/format/parent-contacts-format.mjs';
import { groupNameOf } from '#shared/domain/record-labels.mjs';
import { visitStatusBadgeClass } from './visit-labels.mjs';
import { quickStatusButtonsMarkup, enrolButtonMarkup } from './visits-list.view.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/record-types.mjs').Visit} Visit */

/** @param {Visit} visit @param {RecordsSnapshot} records */
function detailHTML(visit, records) {
  const groupLabel = groupNameOf(visit.desiredGroupId, records.groups);
  const meta = [
    groupLabel ? `Grupa dorită: ${escapeHtml(groupLabel)}` : '',
    visit.desiredStartDate ? `Data dorită: ${formatDate(visit.desiredStartDate)}` : '',
  ].filter(Boolean);
  return (
    `<div class="visit-detail-head">` +
    `<strong>${escapeHtml(visit.name)}</strong>` +
    `<small>${escapeHtml(formatAge(visit.birthDate))}</small>` +
    `<span class="badge ${visitStatusBadgeClass(visit.status)}">${escapeHtml(visit.status)}</span>` +
    `</div>` +
    `<p>${formatParentContacts(/** @type {any} */ (visit))}</p>` +
    (meta.length ? `<p><small>${meta.join(' · ')}</small></p>` : '') +
    `<div class="visit-detail-actions">${quickStatusButtonsMarkup(visit)}${enrolButtonMarkup(visit)}</div>`
  );
}

// Detaliul vizitei alese din calendar: aceleași acțiuni rapide (statut,
// „Înscrie copilul”) ca în listă, prin `onQuickAction` — nicio logică nouă.
/**
 * @param {{ elements: { detail: HTMLElement } }} dependencies
 */
export function createVisitDetailView({ elements: { detail } }) {
  /**
   * @param {{
   *   visit: Visit | null,
   *   records: RecordsSnapshot,
   *   onQuickAction: (visitId: string, action: string) => void,
   * }} state
   */
  function render({ visit, records, onQuickAction }) {
    if (!visit) {
      detail.hidden = true;
      detail.innerHTML = '';
      return;
    }
    detail.hidden = false;
    detail.innerHTML = detailHTML(visit, records);
    detail.onclick = event => {
      const button = /** @type {HTMLElement} */ (event.target).closest('[data-visit-action]');
      if (!button) return;
      onQuickAction(/** @type {any} */ (button).dataset.id, /** @type {any} */ (button).dataset.visitAction);
    };
  }
  return { render };
}
