const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

// docs/design/screens/32-actualizari.md („Compatibilitate”): „Fiecare cerere /v1/* trimite
// X-Startica-Version” — același nume pe server (sync-server/src/version-gate.mjs).
const CLIENT_VERSION_HEADER = 'X-Startica-Version';

export class SyncNetworkError extends Error {}
export class SyncRevokedError extends Error {}
export class SyncHttpError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
/** 426 Upgrade Required (SYNC_MIN_CLIENT_VERSION) — mirorul lui SyncHttpError, cu ținta
 * exactă de versiune (`minVersion`) în loc de un cod HTTP, ca sync-engine.service.mjs să
 * n-o scoată dintr-un mesaj text. */
export class SyncIncompatibleError extends Error {
  /** @param {string} minVersion @param {string} [message] */
  constructor(minVersion, message = 'Această versiune este prea veche.') {
    super(message);
    this.minVersion = minVersion;
  }
}

/** @param {string} serverUrl */
function assertServerUrl(serverUrl) {
  const url = new URL(serverUrl);
  if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname))
    throw new Error(
      `Adresa serverului trebuie să fie https:// (http:// e permis doar spre 127.0.0.1/localhost, pentru dezvoltare): „${serverUrl}”.`,
    );
}

/** @param {string} rawEvent */
function parseSeqFromSseEvent(rawEvent) {
  const dataLine = rawEvent.split('\n').find(line => line.startsWith('data:'));
  if (!dataLine) return undefined;
  try {
    const data = JSON.parse(dataLine.slice(5).trim());
    return typeof data?.seq === 'number' ? data.seq : undefined;
  } catch {
    // Heartbeat-ul serverului e un comentariu SSE (`: ping`), fără linie „data:” — ignorat aici.
    return undefined;
  }
}

const EVENTS_INITIAL_RECONNECT_MS = 2000;
const EVENTS_MAX_RECONNECT_MS = 30000;

/**
 * Clientul HTTP către sync-server/ (contractul din Fazele 1-3 ale planului).
 * Traduce fiecare eroare de rețea/HTTP într-un tip anume, ca motorul de
 * sincronizare (Faza 3) să decidă starea `connection` fără să inspecteze coduri.
 * @param {{
 *   serverUrl: string, token?: string, fetch?: typeof fetch, timeoutMs?: number,
 *   setTimeoutFn?: typeof setTimeout, clearTimeoutFn?: typeof clearTimeout,
 *   clientVersion?: string,
 * }} dependencies
 */
export function createSyncHttpClient({
  serverUrl,
  token,
  fetch: fetchImpl = globalThis.fetch,
  timeoutMs = 10000,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  // §5.2 (37d): versiunea aplicației (package.json#version) — lipsă doar într-un apelant
  // care nu o dă (teste izolate); serverul tratează absența antetului ca „client dinainte
  // de el”, nu ca eroare (version-gate.mjs).
  clientVersion,
}) {
  assertServerUrl(serverUrl);
  const base = serverUrl.replace(/\/+$/, '');
  /** @type {Record<string, string>} */
  const versionHeader = clientVersion ? { [CLIENT_VERSION_HEADER]: clientVersion } : {};

  /**
   * @param {string} path
   * @param {{ method?: string, body?: unknown }} [options]
   */
  async function request(path, { method = 'GET', body } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(base + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...versionHeader,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      throw new SyncNetworkError(`Serverul de sincronizare nu răspunde: ${/** @type {Error} */ (error).message}`);
    } finally {
      clearTimeout(timeout);
    }
    if (response.status === 401) throw new SyncRevokedError('Acest calculator a fost deconectat de pe server.');
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (response.status === 426)
      throw new SyncIncompatibleError(payload?.minVersion || '', payload?.error || undefined);
    if (!response.ok)
      throw new SyncHttpError(
        response.status,
        payload?.error || `Eroare de la serverul de sincronizare (${response.status}).`,
      );
    return payload;
  }

  return {
    /** @param {{ code?: string, setupKey?: string, name: string, os: string }} input */
    pair: ({ code, setupKey, name, os }) =>
      request('/v1/devices/pair', { method: 'POST', body: { code, setupKey, name, os } }),
    status: () => request('/v1/status'),
    /** §5.3 (36a): profilul ales pentru calculatorul care va folosi codul. */
    createPairingCode: profile => request('/v1/pairing-codes', { method: 'POST', body: { profile } }),
    listDevices: () => request('/v1/devices'),
    /** @param {string} deviceId */
    revokeDevice: deviceId => request(`/v1/devices/${deviceId}/revoke`, { method: 'POST', body: {} }),
    /** §5.3 (36g): propriul profil al dispozitivului autentificat — reîmprospătat de motorul
     * de sincronizare la fiecare ciclu, ca restrângerile/blocarea să ajungă pe calculator
     * fără a aștepta o repornire. */
    fetchMyProfile: () => request('/v1/devices/me'),
    /** §5.3 (36c): doar de pe un dispozitiv Complet. @param {string} deviceId @param {unknown} profile */
    setDeviceProfile: (deviceId, profile) =>
      request(`/v1/devices/${deviceId}/profile`, { method: 'POST', body: { profile } }),
    listBranches: () => request('/v1/branches'),
    /** @param {{ id: string, name: string, color: string, address: string, createdAt: string }} branch */
    registerBranch: branch => request('/v1/branches', { method: 'POST', body: branch }),
    /** @param {string} branchId @param {unknown} snapshot */
    uploadSnapshot: (branchId, snapshot) =>
      request(`/v1/branches/${branchId}/snapshot`, { method: 'POST', body: snapshot }),
    /** @param {string} branchId */
    downloadSnapshot: branchId => request(`/v1/branches/${branchId}/snapshot`),
    /** @param {string} branchId @param {unknown[]} changes */
    pushChanges: (branchId, changes) =>
      request(`/v1/branches/${branchId}/changes`, { method: 'POST', body: { changes } }),
    /** @param {string} branchId @param {number} since @param {number} [limit] */
    pullChanges: (branchId, since, limit = 500) =>
      request(`/v1/branches/${branchId}/changes?since=${encodeURIComponent(since)}&limit=${limit}`),
    /**
     * Wake-up SSE (decizia 7): polling-ul rămâne baza, dar fără reconectare (C-6) o
     * repornire a serverului/Caddy pierde trezirea rapidă până la restartul aplicației
     * sau schimbarea filialei — reconectează cu backoff (2 s → 30 s, dublat la fiecare
     * eșec, resetat la o conexiune reușită), cât timp `close()` nu a fost apelat.
     * @param {string} branchId @param {(seq: number) => void} onSeq
     */
    openEvents(branchId, onSeq) {
      let closed = false;
      let reconnectMs = EVENTS_INITIAL_RECONNECT_MS;
      /** @type {ReturnType<typeof setTimeout> | null} */
      let reconnectTimer = null;
      /** @type {AbortController | null} */
      let controller = null;

      function scheduleReconnect() {
        if (closed) return;
        if (reconnectTimer) clearTimeoutFn(reconnectTimer);
        reconnectTimer = setTimeoutFn(connect, reconnectMs);
        reconnectTimer.unref?.();
        reconnectMs = Math.min(reconnectMs * 2, EVENTS_MAX_RECONNECT_MS);
      }

      function connect() {
        controller = new AbortController();
        fetchImpl(base + `/v1/branches/${branchId}/events`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...versionHeader },
          signal: controller.signal,
        })
          .then(async response => {
            reconnectMs = EVENTS_INITIAL_RECONNECT_MS; // conexiune reușită: reia backoff-ul de la început
            if (!response.body) {
              scheduleReconnect();
              return;
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              let boundary;
              while ((boundary = buffer.indexOf('\n\n')) !== -1) {
                const rawEvent = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);
                const seq = parseSeqFromSseEvent(rawEvent);
                if (seq !== undefined) onSeq(seq);
              }
            }
            // Fluxul s-a terminat fără un close() explicit (server/Caddy repornit) —
            // reconectăm, altfel trezirea rapidă rămâne moartă pentru tot restul sesiunii.
            scheduleReconnect();
          })
          .catch(() => {
            scheduleReconnect();
          });
      }

      connect();
      return {
        close: () => {
          closed = true;
          if (reconnectTimer) clearTimeoutFn(reconnectTimer);
          controller?.abort();
        },
      };
    },
  };
}
