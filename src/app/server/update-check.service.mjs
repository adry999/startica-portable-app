import { compareVersions } from '#shared/domain/version-compare.mjs';

const REQUEST_TIMEOUT_MS = 10000;

/**
 * @typedef {object} UpdateStatus
 * @property {boolean} updateAvailable
 * @property {string} currentVersion
 * @property {string} latestVersion
 * @property {string | null} releaseUrl
 * @property {string | null} downloadUrl
 * @property {string | null} sha256
 * @property {string | null} notes
 * @property {string | null} checkedAt ISO, null dacă nu s-a verificat încă
 * @property {string | null} error
 */

/**
 * URL-ul fix al manifestului publicat ca asset de release (32-actualizari.md): fără API
 * GitHub (limită 60 cereri/oră/IP), fără token — redirect la ultimul release public,
 * niciodată la un pre-release sau draft.
 * @param {string} repo "owner/repo"
 */
export function releaseManifestUrl(repo) {
  return `https://github.com/${repo}/releases/latest/download/latest.json`;
}

/** @param {string} repo */
function releasePageUrl(repo) {
  return `https://github.com/${repo}/releases/latest`;
}

/**
 * @param {string} currentVersion
 * @param {string | null} [error]
 * @returns {UpdateStatus}
 */
function idleStatus(currentVersion, error = null) {
  return {
    updateAvailable: false,
    currentVersion,
    latestVersion: currentVersion,
    releaseUrl: null,
    downloadUrl: null,
    sha256: null,
    notes: null,
    checkedAt: new Date().toISOString(),
    error,
  };
}

/**
 * Citește `latest.json` și compară cu versiunea curentă. Nu aruncă niciodată — orice eșec
 * (rețea, HTTP, JSON fără versiune validă) întoarce starea „la zi" cu un mesaj în `error`,
 * ca pornirea sau verificarea periodică (main.mjs) să nu se blocheze — același tipar ca
 * `fetchBnmEurRate` din bnm-exchange-rate.mjs.
 * @param {{ fetch: typeof fetch, repo: string, currentVersion: string }} args
 * @returns {Promise<UpdateStatus>}
 */
export async function checkForUpdate({ fetch: fetchImpl, repo, currentVersion }) {
  try {
    const response = await fetchImpl(releaseManifestUrl(repo), { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) return idleStatus(currentVersion, `GitHub a răspuns cu eroare HTTP ${response.status}.`);
    const manifest = await response.json();
    if (!manifest || typeof manifest.version !== 'string')
      return idleStatus(currentVersion, 'Manifestul latest.json nu conține o versiune validă.');
    const comparison = compareVersions(currentVersion, manifest.version);
    return {
      updateAvailable: comparison === -1,
      currentVersion,
      latestVersion: manifest.version,
      releaseUrl: releasePageUrl(repo),
      downloadUrl: typeof manifest.downloadUrl === 'string' ? manifest.downloadUrl : null,
      sha256: typeof manifest.sha256 === 'string' ? manifest.sha256 : null,
      notes: typeof manifest.notes === 'string' ? manifest.notes : null,
      checkedAt: new Date().toISOString(),
      error: null,
    };
  } catch (error) {
    const failure = /** @type {Error} */ (error);
    return idleStatus(
      currentVersion,
      'Fără internet sau GitHub indisponibil: ' + (failure.message || 'eroare necunoscută'),
    );
  }
}

/**
 * Stare cu memorie: `/api/session` (session.routes.mjs) citește `status()` sincron la
 * fiecare cerere, fără rețea — verificarea reală rulează doar la `refresh()`, chemată la
 * pornire și o dată la 6 ore din main.mjs (tiparul `bnmPollTimer` orar).
 * @param {{ fetch: typeof fetch, repo: string, currentVersion: string }} args
 */
export function createUpdateChecker({ fetch: fetchImpl, repo, currentVersion }) {
  // checkedAt: null — diferit de „verificat chiar acum, fără actualizare" (idleStatus ar
  // pune ora curentă): clientul trebuie să poată arăta „nicio verificare încă”, dacă vrea.
  /** @type {UpdateStatus} */
  let last = { ...idleStatus(currentVersion), checkedAt: null };
  return {
    status: () => last,
    refresh: async () => {
      last = await checkForUpdate({ fetch: fetchImpl, repo, currentVersion });
      return last;
    },
  };
}
