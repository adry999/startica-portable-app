import { ApiError } from './api-error.mjs';

const NETWORK_RETRY_HINT = 'Apasă „Reîncarcă” pentru a verifica ultima operațiune.';

/** @typedef {(path: string, options: RequestInit) => Promise<{ ok: boolean, status: number, json: () => Promise<any> }>} FetchResource */

/**
 * @param {{
 *   readSessionToken: () => string,
 *   reportConnection: (errorMessage: string) => void,
 *   fetchResource?: FetchResource,
 * }} options
 */
export function createApiClient({
  readSessionToken,
  reportConnection,
  // Indirecție, nu `= fetch`: leagă implicit la `fetch` curent la fiecare
  // cerere, ca testele care înlocuiesc `window.fetch` după pornire să prindă.
  fetchResource = (path, options) => fetch(path, options),
}) {
  function networkFailure() {
    reportConnection(NETWORK_RETRY_HINT);
    return new ApiError('Conexiune întreruptă. ' + NETWORK_RETRY_HINT, { kind: 'network' });
  }

  /**
   * @param {string} path
   * @param {unknown} [body]
   */
  async function requestJson(path, body) {
    let response;
    try {
      response = await fetchResource(path, {
        signal: AbortSignal.timeout(body === undefined ? 10000 : 60000),
        ...(body === undefined
          ? {}
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Startica-Token': readSessionToken() },
              body: JSON.stringify(body),
            }),
      });
    } catch {
      throw networkFailure();
    }
    let result;
    try {
      result = await response.json();
    } catch (e) {
      // Corpul întrerupt sau expirat rămâne o cădere de conexiune.
      const failure = /** @type {{ name?: string }} */ (e);
      if (failure?.name === 'AbortError' || failure?.name === 'TimeoutError') throw networkFailure();
      reportConnection('');
      throw new ApiError(
        `Serverul a răspuns neașteptat (cod ${response.status}). Apasă „Reîncarcă” și verifică jurnalele.`,
        { kind: 'unexpected-response', status: response.status },
      );
    }
    reportConnection('');
    if (!response.ok)
      throw new ApiError(result.error || 'Operațiunea a eșuat.', { kind: 'rejected', status: response.status });
    return result;
  }

  return { requestJson };
}
