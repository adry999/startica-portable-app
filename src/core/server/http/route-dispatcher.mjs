import { fail } from '../errors/domain-error.mjs';
import { assertAllowedRequest, assertAuthorizedWrite, readJsonBody } from './request-guards.mjs';
import { isStaticAsset, sendStaticAsset } from './static-assets.mjs';
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

/**
 * @param {{
 *   root: string, sessionToken: string, routes: RouteDefinition[], log?: (message: unknown) => void,
 *   resolveRouteModule?: (request: { method: 'GET' | 'POST', path: string, body?: unknown }) => { moduleId: string | string[], write: boolean, pinExempt?: boolean } | null,
 *   assertModuleAccess?: (moduleId: string | string[], options: { write: boolean }) => void,
 *   assertPinUnlocked?: (moduleId: string | string[]) => void,
 * }} options
 */
export function createRouteDispatcher({
  root,
  sessionToken,
  routes,
  log = console.error,
  // §5.3 (36h): gărzi de profil, opționale — implicitul (teste, sync-server, orice context
  // fără profiluri) nu restrânge nimic. Compuse din bucăți (ce modul guvernează calea, dacă
  // accesul e permis, dacă modulul cere PIN) ca `route-modules.mjs` să rămână testabil fără un
  // server HTTP real. `assertPinUnlocked` (§7, 36h): a doua gardă, după cea de modul — o cale
  // marcată `pinExempt` (PIN-ul însuși) nu trece prin ea, altfel nu s-ar mai putea debloca.
  resolveRouteModule = () => null,
  assertModuleAccess = () => {},
  assertPinUnlocked = () => {},
}) {
  const getRoutes = new Map(routes.filter(route => route.method === 'GET').map(route => [route.path, route.handle]));
  const postRoutes = new Map(routes.filter(route => route.method === 'POST').map(route => [route.path, route.handle]));

  async function dispatchRequest(request, response, port) {
    try {
      const url = assertAllowedRequest(request, port);
      const path = url.pathname;
      if (request.method === 'GET') {
        const getHandler = getRoutes.get(path);
        // await pe o valoare simplă e un no-op: rutele existente rămân sincrone,
        // Telegram (§4) e prima care așteaptă un apel de rețea înainte de răspuns.
        // RESPONSE_SENT: un flux SSE (sincronizare, Faza 3) își scrie singur antetele
        // și răspunsul, exact ca ruta POST /api/shutdown — nu mai are ce trimite aici.
        if (getHandler) {
          const getModule = resolveRouteModule({ method: 'GET', path });
          if (getModule) {
            assertModuleAccess(getModule.moduleId, { write: getModule.write });
            if (!getModule.pinExempt) assertPinUnlocked(getModule.moduleId);
          }
          const result = await getHandler({ url, response });
          if (result !== RESPONSE_SENT) sendResponse(response, result);
          return;
        }
        // Ruta API înregistrată are întâietate; restul cade pe fișierele din build
        // (sau pe index.html — SPA fără router propriu). /api/* nu ajunge niciodată
        // aici din greșeală ca index.html: o cale API neînregistrată rămâne 404.
        if (!path.startsWith('/api/') && isStaticAsset(root, path)) return sendStaticAsset(response, root, path);
      }
      if (request.method !== 'POST') fail('Pagina nu există.', 404);
      assertAuthorizedWrite(request, sessionToken);
      const postHandler = postRoutes.get(path);
      if (!postHandler) fail('Operațiune inexistentă.', 404);
      const body = await readJsonBody(request);
      // Gărzile dinamice (/api/record, de ex.) au nevoie de corp ca să afle tipul înregistrării.
      const postModule = resolveRouteModule({ method: 'POST', path, body });
      if (postModule) {
        assertModuleAccess(postModule.moduleId, { write: postModule.write });
        if (!postModule.pinExempt) assertPinUnlocked(postModule.moduleId);
      }
      const result = await postHandler({ body, url, response });
      if (result !== RESPONSE_SENT) sendResponse(response, result);
    } catch (error) {
      const failure = /** @type {Error & { status?: number, code?: string, errcode?: number }} */ (error);
      // A doua scriere ar arunca ERR_HTTP_HEADERS_SENT dacă antetele au plecat deja.
      if (response.headersSent) {
        log('Eroare după trimiterea răspunsului: ' + failure.message);
        return;
      }
      // Erorile Node/SQLite și cele de programare (nu fail() de domeniu) nu au mesaj pentru utilizator; doar în jurnal.
      if (
        failure.code ||
        failure.errcode ||
        failure instanceof TypeError ||
        failure instanceof RangeError ||
        failure instanceof ReferenceError
      ) {
        log(failure.stack || failure);
        sendResponse(response, { error: 'Eroare de sistem (disc, fișiere sau internă). Detalii în jurnal.' }, 500);
        return;
      }
      sendResponse(response, { error: failure.message }, failure.status || 400);
    }
  }

  return { dispatchRequest };
}
