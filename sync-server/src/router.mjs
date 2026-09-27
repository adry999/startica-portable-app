// Router propriu, nu #core/server/http/route-dispatcher.mjs din aplicație: acela e cu
// căi plate și gardă de loopback, nu are id-uri în cale, iar sync-server/ nu importă
// nimic din src/ (rulează separat, într-un container propriu).

// Handlerul a răspuns singur (SSE); nu se mai trimite nimic.
export const RESPONSE_SENT = Symbol('response-sent');

const DEFAULT_MAX_BODY_BYTES = 20 * 1024 * 1024;

/**
 * @param {string} message
 * @param {number} [status]
 * @returns {never}
 */
export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
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
 * propriu (Caddy) — altfel un client rău-intenționat își poate falsifica adresa și evita
 * limitatorul de rată pentru codurile de conectare.
 * @param {import('node:http').IncomingMessage} request
 * @param {boolean} trustProxy
 */
export function clientIp(request, trustProxy) {
  if (trustProxy) {
    const forwarded = request.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.socket.remoteAddress ?? 'necunoscut';
}

/**
 * @param {{
 *   routes: RouteDefinition[],
 *   authenticate: (request: import('node:http').IncomingMessage) => unknown,
 *   trustProxy?: boolean,
 *   log?: (message: unknown) => void,
 * }} options
 */
export function createRouter({ routes, authenticate, trustProxy = false, log = console.error }) {
  /**
   * @param {import('node:http').IncomingMessage} request
   * @param {import('node:http').ServerResponse} response
   */
  async function handleRequest(request, response) {
    try {
      const url = new URL(/** @type {string} */ (request.url), `http://${request.headers.host ?? 'localhost'}`);
      const route = routes.find(
        candidate => candidate.method === request.method && candidate.pattern.test(url.pathname),
      );
      if (!route) return sendJson(response, { error: 'Ruta nu există.' }, 404);
      const match = /** @type {RegExpExecArray} */ (route.pattern.exec(url.pathname));
      const params = /** @type {Record<string, string>} */ (match.groups ?? {});
      const ip = clientIp(request, trustProxy);
      const device = route.auth ? await authenticate(request) : undefined;
      const body =
        request.method === 'POST'
          ? await readJsonBody(request, route.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES)
          : undefined;
      const result = await route.handle({ params, body, device, url, clientIp: ip, response });
      if (result !== RESPONSE_SENT) sendJson(response, result);
    } catch (error) {
      if (response.writableEnded) {
        log('Eroare după trimiterea răspunsului: ' + /** @type {Error} */ (error).message);
        return;
      }
      const failure = /** @type {Error & { status?: number, code?: string }} */ (error);
      if (failure.status) {
        sendJson(response, { error: failure.message }, failure.status);
        return;
      }
      log(failure.stack || failure);
      sendJson(response, { error: 'Eroare de sistem pe server. Detalii în jurnal.' }, 500);
    }
  }

  return { handleRequest };
}
