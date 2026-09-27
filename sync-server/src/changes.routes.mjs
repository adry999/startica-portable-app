import { fail, RESPONSE_SENT } from './router.mjs';
import { KINDS } from './change-policy.mjs';

const SNAPSHOT_MAX_BYTES = 64 * 1024 * 1024;
const HEARTBEAT_MS = 25000;
const DEFAULT_PULL_LIMIT = 500;

/** @param {unknown} change */
function assertValidChange(change) {
  const candidate = /** @type {Record<string, unknown> | null} */ (change);
  if (
    !candidate ||
    typeof candidate.changeId !== 'string' ||
    !KINDS.includes(/** @type {string} */ (candidate.kind)) ||
    typeof candidate.recordId !== 'string' ||
    typeof candidate.baseRevision !== 'number' ||
    typeof candidate.changedAt !== 'string'
  )
    fail('Modificare invalidă în lotul trimis.', 400);
}

/**
 * @param {{
 *   changesService: ReturnType<typeof import('./changes.service.mjs').createChangesService>,
 *   branches: ReturnType<typeof import('./branches.repository.mjs').createBranchesRepository>,
 *   devices: ReturnType<typeof import('./devices.repository.mjs').createDevicesRepository>,
 *   events: ReturnType<typeof import('./events.mjs').createEventHub>,
 *   now: () => Date,
 * }} dependencies
 */
export function createChangesRoutes({ changesService, branches, devices, events, now }) {
  /** @param {string} id */
  function ensureBranchExists(id) {
    if (!branches.findById(id)) fail('Filială inexistentă.', 404);
  }

  /** @param {{ params: Record<string, string>, body: unknown, device: unknown }} context */
  function push({ params, body, device }) {
    ensureBranchExists(params.id);
    const payload = /** @type {{ changes?: unknown[] }} */ (body ?? {});
    if (!Array.isArray(payload.changes)) fail('Corpul trebuie să conțină „changes”.', 400);
    payload.changes.forEach(assertValidChange);
    const changes = /** @type {import('./changes.service.mjs').IncomingChange[]} */ (payload.changes);
    const deviceId = /** @type {{ id: string }} */ (device).id;
    devices.touchLastSeen(deviceId, { branchId: params.id, now: now().toISOString() });
    const result = changesService.applyPush({ branchId: params.id, deviceId, changes, now: now() });
    if (result.results.some(entry => entry.status === 'applied'))
      events.publish(params.id, changesService.branchHeadSeq(params.id));
    return result;
  }

  /** @param {{ params: Record<string, string>, url: URL }} context */
  function pull({ params, url }) {
    ensureBranchExists(params.id);
    const since = Number(url.searchParams.get('since') ?? '0');
    const limit = Number(url.searchParams.get('limit') ?? String(DEFAULT_PULL_LIMIT));
    return changesService.pull({ branchId: params.id, since, limit });
  }

  /** @param {{ params: Record<string, string>, body: unknown, device: unknown }} context */
  function writeSnapshot({ params, body, device }) {
    ensureBranchExists(params.id);
    const payload = /** @type {{ entries?: unknown[] }} */ (body ?? {});
    if (!Array.isArray(payload.entries)) fail('Corpul trebuie să conțină „entries”.', 400);
    const entries = /** @type {{ kind: string, id: string, payload: unknown, updatedAt: string }[]} */ (
      payload.entries
    );
    const deviceId = /** @type {{ id: string }} */ (device).id;
    return changesService.writeSnapshot({ branchId: params.id, deviceId, entries, now: now() });
  }

  /** @param {{ params: Record<string, string> }} context */
  function readSnapshot({ params }) {
    ensureBranchExists(params.id);
    return changesService.readSnapshot({ branchId: params.id });
  }

  /** @param {{ params: Record<string, string>, response: import('node:http').ServerResponse }} context */
  function streamEvents({ params, response }) {
    ensureBranchExists(params.id);
    // Connection: close — nu o socket ținută vie pentru refolosire: o dată terminat
    // fluxul (oprirea serverului sau schimbarea filialei), soclul se închide imediat,
    // nu abia la timeout-ul implicit de keep-alive.
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'close',
    });
    // writeHead() singur nu trimite nimic pe soclu — Node bufferează antetele până la
    // primul write(); fără flushHeaders(), clientul ar aștepta degeaba până la primul
    // heartbeat (25 s) ca să vadă statusul 200.
    response.flushHeaders();
    const unsubscribe = events.subscribe(params.id, response);
    const heartbeat = setInterval(() => response.write(': ping\n\n'), HEARTBEAT_MS);
    heartbeat.unref?.();
    response.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
    return RESPONSE_SENT;
  }

  /** @type {import('./router.mjs').RouteDefinition[]} */
  const routes = [
    { method: 'POST', pattern: /^\/v1\/branches\/(?<id>[^/]+)\/changes$/, auth: true, handle: push },
    { method: 'GET', pattern: /^\/v1\/branches\/(?<id>[^/]+)\/changes$/, auth: true, handle: pull },
    {
      method: 'POST',
      pattern: /^\/v1\/branches\/(?<id>[^/]+)\/snapshot$/,
      auth: true,
      maxBodyBytes: SNAPSHOT_MAX_BYTES,
      handle: writeSnapshot,
    },
    { method: 'GET', pattern: /^\/v1\/branches\/(?<id>[^/]+)\/snapshot$/, auth: true, handle: readSnapshot },
    { method: 'GET', pattern: /^\/v1\/branches\/(?<id>[^/]+)\/events$/, auth: true, handle: streamEvents },
  ];
  return { routes };
}
