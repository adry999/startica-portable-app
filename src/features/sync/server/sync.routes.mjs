import { RESPONSE_SENT } from '#core/server/http/route-dispatcher.mjs';

const HEARTBEAT_MS = 25000;

/** @typedef {ReturnType<ReturnType<typeof import('./sync-engine.service.mjs').createSyncEngine>['status']>} EngineStatus */

/** @type {EngineStatus} */
const EMPTY_ENGINE_STATUS = {
  connection: 'online',
  pending: 0,
  pushing: false,
  lastSyncedAt: '',
  conflicts: 0,
  lastError: '',
  profile: null,
};

const CONNECTION_RANK = { revoked: 2, offline: 1, online: 0 };

/**
 * Setul comun (Personal 24, decizia 9) are propriul motor, pornit alături de acest context
 * și niciodată oprit la schimbarea filialei — starea lui (pending/conflicts) se adună la cea
 * a filialei active, ca operatorul să vadă un singur card, nu două. `connection` ia varianta
 * mai gravă dintre cele două (revoked > offline > online); `lastError` arată eroarea filialei,
 * sau a setului comun dacă filiala nu are niciuna.
 * @param {EngineStatus} branchStatus @param {EngineStatus} commonStatus
 */
function mergeEngineStatus(branchStatus, commonStatus) {
  return {
    connection:
      CONNECTION_RANK[commonStatus.connection] > CONNECTION_RANK[branchStatus.connection]
        ? commonStatus.connection
        : branchStatus.connection,
    pending: branchStatus.pending + commonStatus.pending,
    pushing: branchStatus.pushing || commonStatus.pushing,
    lastSyncedAt:
      branchStatus.lastSyncedAt && commonStatus.lastSyncedAt
        ? branchStatus.lastSyncedAt > commonStatus.lastSyncedAt
          ? branchStatus.lastSyncedAt
          : commonStatus.lastSyncedAt
        : branchStatus.lastSyncedAt || commonStatus.lastSyncedAt,
    conflicts: branchStatus.conflicts + commonStatus.conflicts,
    lastError: branchStatus.lastError || commonStatus.lastError,
    // §5.3: amândouă motoarele reîmprospătează același profil (un singur calculator) — oricare
    // valoare cunoscută e bună; branșa activă e sursa preferată (se sincronizează mai des).
    profile: branchStatus.profile ?? commonStatus.profile,
  };
}

/** @param {import('node:http').ServerResponse} response @param {string} event @param {unknown} data */
function writeEvent(response, event, data) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Rutele locale ale cardului de sincronizare (14a): status, evenimente în timp real
 * (SSE, ca modificările de pe alt calculator să reîncarce ecranul) și „Sincronizează
 * acum”. Motorul (`engine`) poate fi absent — instalare fără `sync.json` — caz în
 * care rutele răspund `configured: false`, fără nicio cerere de rețea. `getCommonEngine`
 * (Personal 24, decizia 9) e motorul separat al setului comun — statusul lui se adună
 * la cel al filialei, iar „Sincronizează acum” pornește pe amândoi.
 * @param {{
 *   syncDevice: { read: () => import('../sync.types.d.mts').SyncDeviceFile | null },
 *   getEngine: () => ReturnType<typeof import('./sync-engine.service.mjs').createSyncEngine> | null,
 *   getCommonEngine?: () => ReturnType<typeof import('./sync-engine.service.mjs').createSyncEngine> | null,
 * }} dependencies
 */
export function createSyncRoutes({ syncDevice, getEngine, getCommonEngine = () => null }) {
  /** @type {Set<import('node:http').ServerResponse>} */
  const subscribers = new Set();

  function statusPayload() {
    const device = syncDevice.read();
    if (!device)
      return {
        configured: false,
        serverUrl: '',
        deviceName: '',
        ...EMPTY_ENGINE_STATUS,
      };
    const engine = getEngine();
    const engineStatus = engine ? engine.status() : EMPTY_ENGINE_STATUS;
    const commonEngine = getCommonEngine();
    const merged = commonEngine ? mergeEngineStatus(engineStatus, commonEngine.status()) : engineStatus;
    return { configured: true, serverUrl: device.serverUrl, deviceName: device.deviceName, ...merged };
  }

  /** Trecut motorului ca `onStatus` — fan-out local, către toate filele deschise. */
  function broadcastStatus() {
    const payload = statusPayload();
    for (const response of subscribers) writeEvent(response, 'status', payload);
  }

  /**
   * Trecut motorului ca `onRecordsChanged` — spune filelor deschise să reîncarce datele.
   * `dataset` (Personal 24, decizia 9): `'branch'` pentru motorul filialei (implicit, valoarea
   * de până acum), `'comun'` pentru motorul setului comun — `usePersonal()`/`usePool()` din
   * webapp reîncarcă doar pe cel care le privește, sesiunea filialei ignoră `'comun'`.
   * @param {number} revision @param {'branch' | 'comun'} [dataset]
   */
  function broadcastRecordsChanged(revision, dataset = 'branch') {
    for (const response of subscribers) writeEvent(response, 'records-changed', { revision, dataset });
  }

  /** @param {{ response: import('node:http').ServerResponse }} request */
  function streamEvents({ response }) {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'close',
    });
    response.flushHeaders();
    subscribers.add(response);
    writeEvent(response, 'status', statusPayload());
    const heartbeat = setInterval(() => response.write(': ping\n\n'), HEARTBEAT_MS);
    heartbeat.unref?.();
    response.on('close', () => {
      clearInterval(heartbeat);
      subscribers.delete(response);
    });
    return RESPONSE_SENT;
  }

  async function syncNow() {
    const engine = getEngine();
    const commonEngine = getCommonEngine();
    // Paralel, nu secvențial — cele două motoare nu împart nimic (baze diferite), iar
    // „Sincronizează acum” nu trebuie să aștepte de două ori la rând.
    await Promise.all([engine?.syncNow(), commonEngine?.syncNow()].filter(Boolean));
    return statusPayload();
  }

  return {
    routes: [
      { method: 'GET', path: '/api/sync/status', handle: () => statusPayload() },
      { method: 'GET', path: '/api/sync/events', handle: streamEvents },
      { method: 'POST', path: '/api/sync/now', handle: syncNow },
    ],
    onStatus: broadcastStatus,
    onRecordsChanged: broadcastRecordsChanged,
    // Închise la schimbarea filialei sau la oprirea aplicației, ca un flux SSE
    // rămas deschis pe o filială care nu mai există să nu blocheze soclul.
    close: () => {
      for (const response of subscribers) response.end();
      subscribers.clear();
    },
  };
}
