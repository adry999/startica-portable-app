import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { childNameOf, groupNameOf } from '#shared/domain/record-labels.mjs';
import { recordActionButton } from '#shared/ui/record-actions.mjs';
import { paginateRows } from '#shared/ui/pagination.mjs';
import { REVIEW_FILTERS, filterReviewItems } from '../domain/review-center.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('../review-center.types.mjs').ReviewItem} ReviewItem */
/** @typedef {import('../review-center.types.mjs').ReviewCenter} ReviewCenter */

const reviewTag = (category, labels) =>
  `<span class="review-tag ${escapeHtml(category)}">${escapeHtml(labels[category] || category)}</span>`;

/**
 * @param {ReviewItem} reviewItem
 * @param {RecordsSnapshot['children']} children
 * @param {RecordsSnapshot['groups']} groups
 * @param {Record<string, string>} labels
 */
function reviewRow(reviewItem, children, groups, labels) {
  const payment = reviewItem.type === 'payments',
    // reviewItem.record e Child | Payment; câmpurile citite mai jos depind de reviewItem.type.
    record = /** @type {any} */ (reviewItem.record);
  const details = payment
    ? `${formatDate(record.date)} · ${formatMoney(record.amount)}${record.sourceName ? ` · sursă: ${escapeHtml(record.sourceName)}` : ''}${record.childId ? ` · copil: ${escapeHtml(childNameOf(record, children))}` : ''}`
    : `Contract: ${escapeHtml(record.contractNumber || record.id)} · Grupă: ${escapeHtml(groupNameOf(record.groupId, groups) || 'necompletată')}`;
  const tags = reviewItem.categories.map(category => reviewTag(category, labels)).join('');
  const confirm = reviewItem.canConfirm
    ? recordActionButton('confirm-review', 'payments', reviewItem.id, 'Confirmă asocierea')
    : '';
  return (
    `<div class="review-row"><span><strong>${escapeHtml(reviewItem.name)}</strong> · ${escapeHtml(reviewItem.id)}` +
    `<div class="review-tags">${tags}</div><small>${details}</small>` +
    `<small>${reviewItem.reasons.map(reason => escapeHtml(reason)).join(' · ')}</small></span>` +
    `<div class="review-actions">${recordActionButton('edit', reviewItem.type, reviewItem.id, payment ? 'Corectează achitarea' : 'Corectează fișa')}${confirm}</div></div>`
  );
}

/**
 * @param {{
 *   elements: { progress: HTMLElement, list: HTMLElement, filter: HTMLSelectElement, search: HTMLInputElement },
 *   readRecords: () => RecordsSnapshot,
 * }} dependencies
 * @returns {(center: ReviewCenter) => void}
 */
export function createReviewCenterView({ elements: { progress, list, filter, search }, readRecords }) {
  // Opțiunile filtrului vin din aceeași listă pe care o folosește gruparea, ca
  // adăugarea unei categorii să nu ceară și o editare în HTML.
  let filtersReady = false;
  function fillReviewFilter() {
    if (filtersReady) return;
    filter.innerHTML = REVIEW_FILTERS.map(
      ([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`,
    ).join('');
    filtersReady = true;
  }

  return function renderReviewCenter(center) {
    fillReviewFilter();
    const rows = filterReviewItems(center, filter.value, search.value),
      reviewProgress = center.progress;
    progress.innerHTML =
      `<article><small>Probleme afișate</small><strong>${rows.length}</strong><small>din ${center.items.length} fișe / achitări cu observații</small></article>` +
      `<article><small>Verificări import confirmate</small><strong>${reviewProgress.confirmed} / ${reviewProgress.total}</strong><small>confirmarea păstrează asocierea și suma existente</small></article>` +
      `<article><small>Verificări import rămase</small><strong>${reviewProgress.pending}</strong><small>achitările fără copil, dublurile și sumele provizorii necesită corectare</small></article>`;
    list.innerHTML = `<div id="reviewPager" class="pager"></div><div id="reviewRows"></div>`;
    const { children, groups } = readRecords();
    const reviewRows = /** @type {HTMLElement} */ (list.querySelector('#reviewRows'));
    const pagedRows = /** @type {ReviewItem[]} */ (paginateRows('review', rows));
    reviewRows.innerHTML =
      pagedRows.map(reviewItem => reviewRow(reviewItem, children, groups, center.labels)).join('') ||
      '<p class="empty">Nu există înregistrări pentru filtrul ales.</p>';
  };
}
