import { fail } from '#core/server/errors/domain-error.mjs';

/**
 * Rutele §5.2 Partea 2 (PROMPT-CLAUDE-CODE-10.md §8): declanșarea descărcării instalerului
 * verificat (`update-download.service.mjs`) și interogarea „e gata de instalat?”. Nu pornesc
 * singure (32-actualizari.md descrie o descărcare „în fundal”, dar pornirea ei automată din
 * main.mjs ar repeta cererea de rețea reală a lui checkForUpdate() la fiecare pornire/6 ore —
 * vezi docs/design/INTREBARI.md, §8 PROMPT-10) — clientul cere explicit descărcarea.
 * @param {{
 *   downloadService: ReturnType<typeof import('./update-download.service.mjs').createUpdateDownloadService>,
 *   updateStatus: () => import('./update-check.service.mjs').UpdateStatus,
 * }} dependencies
 */
export function createUpdateDownloadRoutes({ downloadService, updateStatus }) {
  async function download() {
    const status = updateStatus();
    if (!status.updateAvailable) fail('Nu există nicio actualizare disponibilă de descărcat.', 400);
    return downloadService.downloadAndVerify({
      downloadUrl: status.downloadUrl,
      sha256: status.sha256,
      version: status.latestVersion,
    });
  }

  function pending() {
    return { pending: downloadService.pendingUpdate() };
  }

  return [
    { method: 'POST', path: '/api/update/download', handle: () => download() },
    { method: 'GET', path: '/api/update/pending', handle: () => pending() },
  ];
}
