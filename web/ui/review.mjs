import { filteredReviewItems, reviewFilters } from '../../shared/review-center.mjs';
import { $, esc, money, date } from './dom.mjs';
import { pageRows, button, childName } from './parts.mjs';
import { groupName } from './view-helpers.mjs';

// ─── De verificat ───────────────────────────────────────────────────────────

const reviewTag = (category, labels) =>
  `<span class="review-tag ${esc(category)}">${esc(labels[category] || category)}</span>`;

function reviewRow(item, labels) {
  const payment = item.type === 'payments',
    r = item.record;
  const details = payment
    ? `${date(r.date)} · ${money(r.amount)}${r.sourceName ? ` · sursă: ${esc(r.sourceName)}` : ''}${r.childId ? ` · copil: ${esc(childName(r))}` : ''}`
    : `Contract: ${esc(r.contractNumber || r.id)} · Grupă: ${esc(groupName(r.groupId) || 'necompletată')}`;
  const tags = item.categories.map(category => reviewTag(category, labels)).join('');
  const confirm = item.canConfirm ? button('confirm-review', 'payments', item.id, 'Confirmă asocierea') : '';
  return (
    `<div class="review-row"><span><strong>${esc(item.name)}</strong> · ${esc(item.id)}` +
    `<div class="review-tags">${tags}</div><small>${details}</small>` +
    `<small>${item.reasons.map(esc).join(' · ')}</small></span>` +
    `<div class="review-actions">${button('edit', item.type, item.id, payment ? 'Corectează achitarea' : 'Corectează fișa')}${confirm}</div></div>`
  );
}

// Opțiunile filtrului vin din aceeași listă pe care o folosește gruparea, ca
// adăugarea unei categorii să nu ceară și o editare în HTML.
let filtersReady = false;
function fillReviewFilter() {
  if (filtersReady) return;
  $('reviewFilter').innerHTML = reviewFilters
    .map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`)
    .join('');
  filtersReady = true;
}
export function renderReview(center) {
  fillReviewFilter();
  const rows = filteredReviewItems(center, $('reviewFilter').value, $('reviewSearch').value),
    progress = center.progress;
  $('reviewProgress').innerHTML =
    `<article><small>Probleme afișate</small><strong>${rows.length}</strong><small>din ${center.items.length} fișe / achitări cu observații</small></article>` +
    `<article><small>Verificări import confirmate</small><strong>${progress.confirmed} / ${progress.total}</strong><small>confirmarea păstrează asocierea și suma existente</small></article>` +
    `<article><small>Verificări import rămase</small><strong>${progress.pending}</strong><small>achitările fără copil, dublurile și sumele provizorii necesită corectare</small></article>`;
  $('reviewList').innerHTML = `<div id="reviewPager" class="pager"></div><div id="reviewRows"></div>`;
  $('reviewRows').innerHTML =
    pageRows('review', rows)
      .map(item => reviewRow(item, center.labels))
      .join('') || '<p class="empty">Nu există înregistrări pentru filtrul ales.</p>';
}
