// Router propriu, nu #core/server/http/route-dispatcher.mjs din aplicație: acela e cu
// căi plate și gardă de loopback, nu are id-uri în cale, iar sync-server/ nu importă
// nimic din src/ (rulează separat, într-un container propriu).

// Handlerul a răspuns singur (SSE); nu se mai trimite nimic.
export const RESPONSE_SENT = Symbol('response-sent');

const DEFAULT_MAX_BODY_BYTES = 20 * 1024 * 1024;

/**
 * @param {string} message
 * @param {number} [status]
 * @param {Record<string, unknown>} [details] câmpuri suplimentare în corpul JSON (ex. 426
 *   „minVersion” — vezi version-gate.mjs), alături de „error”, niciodată în locul lui.
 * @returns {never}
 */
export function fail(message, status = 400, details = undefined) {
  throw Object.assign(new Error(message), { status, ...details });
}

/**
 * @typedef {{
 *   method: 'GET' | 'POST',
 *   pattern: RegExp,
 *   auth?: boolean,
 *   maxBodyBytes?: number,
 *   handle: (context: {
 *     params: Record<string, string>,
 *     body: unknown,
 *     device: unknown,
 *     url: URL,
 *     clientIp: string,
 *     response: import('node:http').ServerResponse,
 *   }) => unknown,
 * }} RouteDefinition
 */

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {number} maxBytes
 */
async function readJsonBody(request, maxBytes) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) fail('Corpul cererii este prea mare.', 413);
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    fail('Cererea nu este JSON valid.', 400);
  }
}

/**
 * @param {import('node:http').ServerResponse} response
 * @param {unknown} value
 * @param {number} [status]
 */
function sendJson(response, value, status = 200) {
  const content = Buffer.from(JSON.stringify(value ?? {}));
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': content.length });
  response.end(content);
}

/**
 * IP-ul clientului. `X-Forwarded-For` e de încredere doar în spatele reverse-proxy-ului
 * propriu (Caddy) — dar doar **ultimul salt**, cel adăugat chiar de acel proxy: primul
 * salt e ales de oricine trimite cererea și poate fi falsificat pentru a ocoli limitatorul
 * de rată de la `pair` (D-6). Caddy ≥ 2.5 nu are încredere implicit în XFF-ul clientului,
 * dar un alt proxy care doar adaugă un salt la antetul existent ar fi altfel exploatabil.
 * @param {import('node:http').IncomingMessage} request
 * @param {boolean} trustProxy
 */
export function clientIp(request, trustProxy) {
  if (trustProxy) {
    const forwarded = request.headers['x-forwarded-for'];
    const raw = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
    const hops = raw
      ?.split(',')
      .map(hop => hop.trim())
      .filter(Boolean);
    if (hops?.length) return hops[hops.length - 1];
  }
  return request.socket.remoteAddress ?? 'necunoscut';
}

/**
 * @param {{
 *   routes: RouteDefinition[],
 *   authenticate: (request: import('node:http').IncomingMessage) => unknown,
 *   trustProxy?: boolean,
 *   log?: (message: unknown) => void,
 *   accessLog?: (message: string) => void,
 *   checkClientVersion?: (request: import('node:http').IncomingMessage) => void,
 * }} options
 */
export function createRouter({
  routes,
  authenticate,
  trustProxy = false,
  log = console.error,
  accessLog = console.log,
  // version-gate.mjs (SYNC_MIN_CLIENT_VERSION): verificată înaintea oricărei rute — inclusiv
  // /v1/devices/pair, care nu cere autentificare — ca un client prea vechi să afle imediat,
  // nu abia la primul push/pull autentificat. Implicit no-op (fără SYNC_MIN_CLIENT_VERSION,
  // comportamentul rămâne neschimbat).
  checkClientVersion = () => {},
}) {
  /**
   * @param {import('node:http').IncomingMessage} request
   * @param {import('node:http').ServerResponse} response
   */
  async function handleRequest(request, response) {
    let path = request.url ?? '';
    let status = 200;
    /** @type {string | undefined} */
    let deviceId;
    try {
      const url = new URL(/** @type {string} */ (request.url), `http://${request.headers.host ?? 'localhost'}`);
      path = url.pathname;
      checkClientVersion(request);
      const route = routes.find(
        candidate => candidate.method === request.method && candidate.pattern.test(url.pathname),
      );
      if (!route) {
        status = 404;
        return sendJson(response, { error: 'Ruta nu există.' }, 404);
      }
      const match = /** @type {RegExpExecArray} */ (route.pattern.exec(url.pathname));
      const params = /** @type {Record<string, string>} */ (match.groups ?? {});
      const ip = clientIp(request, trustProxy);
      const device = route.auth ? await authenticate(request) : undefined;
      deviceId = /** @type {{ id: string } | undefined} */ (device)?.id;
      const body =
        request.method === 'POST'
          ? await readJsonBody(request, route.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES)
          : undefined;
      const result = await route.handle({ params, body, device, url, clientIp: ip, response });
      if (result !== RESPONSE_SENT) sendJson(response, result);
      else status = response.statusCode; // flux SSE: antetul e deja trimis de handler
    } catch (error) {
      if (response.writableEnded) {
        log('Eroare după trimiterea răspunsului: ' + /** @type {Error} */ (error).message);
        return;
      }
      const failure = /** @type {Error & { status?: number, code?: string }} */ (error);
      if (failure.status) {
        status = failure.status;
        // Orice câmp suplimentar pus de fail(message, status, details) — „status” însuși,
        // enumerabil pe instanța de Error (Object.assign), e scos ca să nu dubleze codul HTTP.
        const { status: _status, ...details } = /** @type {Record<string, unknown>} */ (
          /** @type {unknown} */ (failure)
        );
        sendJson(response, { error: failure.message, ...details }, failure.status);
        return;
      }
      status = 500;
      log(failure.stack || failure);
      sendJson(response, { error: 'Eroare de sistem pe server. Detalii în jurnal.' }, 500);
    } finally {
      // Jurnal minim de acces (D-10): metodă, cale, status, id de dispozitiv — niciodată
      // corpul cererii sau token-ul, ca să nu ajungă date despre copii în jurnal.
      accessLog(`${request.method} ${path} ${status}${deviceId ? ` device=${deviceId}` : ''}`);
    }
  }

  return { handleRequest };
}
