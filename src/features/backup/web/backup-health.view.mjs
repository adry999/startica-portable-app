import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatDateTime } from '#shared/format/date-format.mjs';
import { formatFileSize } from '#shared/format/file-size-format.mjs';

/** @typedef {import('../backup.types.mjs').BackupHealth} BackupHealth */

// O zi în ms: peste atât, un backup local sau extern e considerat vechi.
const STALE_AFTER_MS = 86400000;

/**
 * @param {{
 *   elements: { status: HTMLElement, details: HTMLElement, externalDirInput: HTMLInputElement },
 *   isExternalDirLocked: () => boolean,
 * }} dependencies
 */
export function createBackupHealthView({ elements: { status, details, externalDirInput }, isExternalDirLocked }) {
  /** @param {BackupHealth} health */
  function renderBackupHealth(health) {
    const stale = !health.lastLocal || Date.now() - new Date(health.lastLocal).getTime() > STALE_AFTER_MS,
      externalStale = !health.lastExternal || Date.now() - new Date(health.lastExternal).getTime() > STALE_AFTER_MS;
    const hasError = !!(health.localError || health.externalError);
    const hasWarning = !hasError && (stale || !health.externalDir || externalStale);
    status.textContent = health.localError
      ? 'Backup local eșuat'
      : stale
        ? 'Backup local vechi/lipsă'
        : !health.externalDir
          ? 'Backup local OK · copie externă neconfigurată'
          : health.externalError || externalStale
            ? 'Copia externă necesită atenție'
            : 'Backup local și copie externă verificate';
    status.dataset.state = hasError ? 'error' : hasWarning ? 'warning' : 'ok';
    status.classList.toggle('danger', hasError || hasWarning);
    details.innerHTML =
      `<p>Bază: ${escapeHtml(health.database)}</p><p>Backup local: ${escapeHtml(formatDateTime(health.lastLocal))}</p>` +
      `<p>Copie externă: ${escapeHtml(formatDateTime(health.lastExternal))}</p>` +
      `<p class="danger">${escapeHtml(health.localError || health.externalError || (!health.externalDir ? 'Copia externă nu este configurată.' : ''))}</p>` +
      `<p>Sincronizarea în cloud nu este confirmată de aplicație. Verifică starea din Google Drive.</p>` +
      `<p>Păstrare locală: ultimele 20 de copii, câte una pentru ultimele 30 de zile cu backup și 12 luni cu backup. ` +
      `Copiile dinaintea importului, restaurării și migrării nu expiră automat: ${health.permanentBackups.count} copii, ${formatFileSize(health.permanentBackups.bytes)}. Șterge-le manual din Startica_Backup dacă nu mai sunt necesare.</p>` +
      (health.externalDir
        ? `<p>Folderul extern urmează aceeași păstrare: ${health.externalBackups.count} copii, ${formatFileSize(health.externalBackups.bytes)}.</p>`
        : '');
    // Câmpul nu se suprascrie cât timp utilizatorul scrie în el.
    if (!isExternalDirLocked()) externalDirInput.value = health.externalDir || '';
  }

  return renderBackupHealth;
}
