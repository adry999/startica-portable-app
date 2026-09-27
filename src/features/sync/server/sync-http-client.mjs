const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export class SyncNetworkError extends Error {}
export class SyncRevokedError extends Error {}
export class SyncHttpError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.status = status;
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

/**
 * Clientul HTTP către sync-server/ (contractul din Fazele 1-3 ale planului).
 * Traduce fiecare eroare de rețea/HTTP într-un tip anume, ca motorul de
 * sincronizare (Faza 3) să decidă starea `connection` fără să inspecteze coduri.
 * @param {{ serverUrl: string, token?: string, fetch?: typeof fetch, timeoutMs?: number }} dependencies
 */
export function createSyncHttpClient({ serverUrl, token, fetch: fetchImpl = globalThis.fetch, timeoutMs = 10000 }) {
  assertServerUrl(serverUrl);
  const base = serverUrl.replace(/\/+$/, '');

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
    createPairingCode: () => request('/v1/pairing-codes', { method: 'POST', body: {} }),
    listDevices: () => request('/v1/devices'),
    /** @param {string} deviceId */
    revokeDevice: deviceId => request(`/v1/devices/${deviceId}/revoke`, { method: 'POST', body: {} }),
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
     * Wake-up SSE (decizia 7): polling-ul rămâne baza, deci o eroare de conexiune
     * aici e ignorată în tăcere — nu există alt consumator al ei decât un semnal mai rapid.
     * @param {string} branchId @param {(seq: number) => void} onSeq
     */
    openEvents(branchId, onSeq) {
      const controller = new AbortController();
      fetchImpl(base + `/v1/branches/${branchId}/events`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      })
        .then(async response => {
          if (!response.body) return;
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
        })
        .catch(() => {});
      return { close: () => controller.abort() };
    },
  };
}
