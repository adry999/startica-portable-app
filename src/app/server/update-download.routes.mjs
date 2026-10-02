import { fail } from '#core/server/errors/domain-error.mjs';

/**
 * Rutele §5.2 Partea 2 (PROMPT-CLAUDE-CODE-10.md §8): declanșarea descărcării instalerului
 * verificat (`update-download.service.mjs`) și interogarea „e gata de instalat?”. Descărcarea
 * pornește deja automat din `checkForUpdate()` (`create-application.mjs`, PROMPT-11 §4.3) —
 * `/api/update/download` rămâne ca rezervă manuală (ex. descărcarea automată a fost oprită prin
 * `STARTICA_UPDATE_AUTO_DOWNLOAD=0`, sau o încercare anterioară a eșuat și operatorul vrea să
 * reîncerce din Backup și setări, fără să aștepte următoarea verificare la 6 ore).
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
