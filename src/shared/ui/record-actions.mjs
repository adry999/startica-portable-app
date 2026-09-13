import { escapeHtml } from '#shared/format/html-escape.mjs';

/**
 * @param {string} action
 * @param {string} type
 * @param {string} id
 * @param {string} label
 */
export function recordActionButton(action, type, id, label) {
  return `<button type="button" class="action-btn" data-action="${action}" data-type="${type}" data-id="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
}

/**
 * @param {string} type
 * @param {{ id: string, archived?: boolean }} record
 */
export function recordActions(type, record) {
  return (
    `<span class="actions">` +
    recordActionButton('edit', type, record.id, 'Editează') +
    recordActionButton('archive', type, record.id, record.archived ? 'Reactivează' : 'Arhivează') +
    (record.archived ? recordActionButton('delete', type, record.id, 'Șterge definitiv') : '') +
    `</span>`
  );
}
