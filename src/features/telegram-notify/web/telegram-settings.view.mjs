import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatDateTime } from '#shared/format/date-format.mjs';

/** @typedef {import('../telegram-notify.types.mjs').TelegramStatus} TelegramStatus */

/**
 * Randează conținutul #telegramStatus, pur: ascunderea butoanelor din toolbar rămâne la controller.
 * @param {TelegramStatus} status
 */
export function renderTelegramStatus(status) {
  if (!status.configured) return '<p>Neconfigurat.</p>';
  let html = `<p>Conectat cu ${escapeHtml(status.chatName)} prin @${escapeHtml(status.botUsername)} · ultimul rezumat: ${escapeHtml(formatDateTime(status.lastSuccess))}</p>`;
  if (status.lastError) html += `<p class="danger">${escapeHtml(status.lastError)}</p>`;
  if (status.stale)
    html +=
      `<p class="danger">Rezumatul nu a mai fost trimis din ${escapeHtml(formatDateTime(status.lastSuccess))}. ` +
      `Verifică Jurnale\\telegram.log; sarcina programată se reînregistrează la pornirea Startica.</p>`;
  return html;
}
