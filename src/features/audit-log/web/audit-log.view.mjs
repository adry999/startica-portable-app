import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatDateTime } from '#shared/format/date-format.mjs';
import { ViewStatus } from '#core/web/view-state.mjs';
import { listChangedFields } from '../domain/audit-change-diff.mjs';

/** @typedef {import('../audit-log.types.mjs').AuditEntry} AuditEntry */
/** @typedef {import('./audit-log.controller.mjs').AuditLogScreenState} AuditLogScreenState */

/** @param {AuditEntry} entry */
function entryMarkup(entry) {
  const changes = listChangedFields(entry.before, entry.after)
    .map(change => `${change.field}: ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`)
    .join('\n');
  return (
    `<details><summary>${escapeHtml(formatDateTime(entry.occurredAt))} · ${escapeHtml(entry.action)} · ` +
    `${escapeHtml(entry.recordId ?? 'Setări')}</summary><pre>${escapeHtml(changes)}</pre></details>`
  );
}

const STATUS_MARKUP = {
  [ViewStatus.Loading]: () => '<p class="muted" role="status">Se încarcă istoricul…</p>',
  [ViewStatus.Empty]: () => '<p class="empty">Nu există modificări înregistrate.</p>',
  [ViewStatus.Failed]: state => `<p class="danger" role="alert">${escapeHtml(state.failure.message)}</p>`,
};

/**
 * @param {{ listElement: HTMLElement, loadMoreButton: HTMLButtonElement, failureElement: HTMLElement }} elements
 * @returns {(state: AuditLogScreenState) => void}
 */
export function createAuditLogView({ listElement, loadMoreButton, failureElement }) {
  let renderedEntryCount = 0;

  return function renderAuditLog(state) {
    if (state.status === ViewStatus.Ready) {
      if (state.entries.length < renderedEntryCount) renderedEntryCount = 0;
      if (renderedEntryCount === 0) listElement.innerHTML = '';
      // Se adaugă doar intrările noi, ca detaliile deja deschise să rămână deschise.
      listElement.insertAdjacentHTML('beforeend', state.entries.slice(renderedEntryCount).map(entryMarkup).join(''));
      renderedEntryCount = state.entries.length;
    } else {
      listElement.innerHTML = STATUS_MARKUP[state.status](state);
      renderedEntryCount = 0;
    }
    loadMoreButton.hidden = !state.hasMore;
    loadMoreButton.disabled = state.isLoadingMore;
    failureElement.textContent = state.status === ViewStatus.Ready && state.failure ? state.failure.message : '';
  };
}
