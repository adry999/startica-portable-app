import { fail } from '../errors/domain-error.mjs';
import { assertAllowedRequest, assertAuthorizedWrite, readJsonBody } from './request-guards.mjs';
import { isStaticAsset, isBrowserModule, sendBrowserModule, sendStaticAsset } from './static-assets.mjs';
import { sendResponse } from './json-response.mjs';

// Handlerul a răspuns singur; nu se mai trimite nimic.
export const RESPONSE_SENT = Symbol('response-sent');

/**
 * @typedef {{
 *   method: 'GET' | 'POST',
 *   path: string,
 *   handle: (context: { body?: unknown, url: URL, response: import('node:http').ServerResponse }) => unknown,
 * }} RouteDefinition
 */

/** @param {{ root: string, sessionToken: string, routes: RouteDefinition[] }} options */
export function createRouteDispatcher({ root, sessionToken, routes }) {
  const getRoutes = new Map(routes.filter(route => route.method === 'GET').map(route => [route.path, route.handle]));
  const postRoutes = new Map(routes.filter(route => route.method === 'POST').map(route => [route.path, route.handle]));

  async function dispatchRequest(request, response, port) {
    try {
      const url = assertAllowedRequest(request, port);
      const path = url.pathname;
      if (request.method === 'GET') {
        if (isStaticAsset(path)) return sendStaticAsset(response, root, path);
        if (isBrowserModule(path)) return sendBrowserModule(response, root, path);
        const getHandler = getRoutes.get(path);
        if (getHandler) return sendResponse(response, getHandler({ url, response }));
      }
      if (request.method !== 'POST') fail('Pagina nu există.', 404);
      assertAuthorizedWrite(request, sessionToken);
      const postHandler = postRoutes.get(path);
      if (!postHandler) fail('Operațiune inexistentă.', 404);
      const body = await readJsonBody(request);
      const result = postHandler({ body, url, response });
      if (result !== RESPONSE_SENT) sendResponse(response, result);
    } catch (error) {
      const failure = /** @type {Error & { status?: number }} */ (error);
      // A doua scriere ar arunca ERR_HTTP_HEADERS_SENT dacă antetele au plecat deja.
      if (response.headersSent) {
        console.error('Eroare după trimiterea răspunsului: ' + failure.message);
        return;
      }
      sendResponse(response, { error: failure.message }, failure.status || 400);
    }
  }

  return { dispatchRequest };
}
