import { RESPONSE_SENT } from '#core/server/http/route-dispatcher.mjs';

const HEARTBEAT_MS = 25000;

/** @param {import('node:http').ServerResponse} response @param {string} event @param {unknown} data */
function writeEvent(response, event, data) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Rutele locale ale cardului de sincronizare (14a): status, evenimente în timp real
 * (SSE, ca modificările de pe alt calculator să reîncarce ecranul) și „Sincronizează
 * acum”. Motorul (`engine`) poate fi absent — instalare fără `sync.json` — caz în
 * care rutele răspund `configured: false`, fără nicio cerere de rețea.
 * @param {{
 *   syncDevice: { read: () => import('../sync.types.d.mts').SyncDeviceFile | null },
 *   getEngine: () => ReturnType<typeof import('./sync-engine.service.mjs').createSyncEngine> | null,
 * }} dependencies
 */
export function createSyncRoutes({ syncDevice, getEngine }) {
  /** @type {Set<import('node:http').ServerResponse>} */
  const subscribers = new Set();

  function statusPayload() {
    const device = syncDevice.read();
    if (!device)
      return {
        configured: false,
        serverUrl: '',
        deviceName: '',
        connection: 'online',
        pending: 0,
        pushing: false,
        lastSyncedAt: '',
        conflicts: 0,
        lastError: '',
      };
    const engine = getEngine();
    const engineStatus = engine
      ? engine.status()
      : { connection: 'online', pending: 0, pushing: false, lastSyncedAt: '', conflicts: 0, lastError: '' };
    return { configured: true, serverUrl: device.serverUrl, deviceName: device.deviceName, ...engineStatus };
  }

  /** Trecut motorului ca `onStatus` — fan-out local, către toate filele deschise. */
  function broadcastStatus() {
    const payload = statusPayload();
    for (const response of subscribers) writeEvent(response, 'status', payload);
  }

  /** Trecut motorului ca `onRecordsChanged` — spune filelor deschise să reîncarce datele. */
  function broadcastRecordsChanged(revision) {
    for (const response of subscribers) writeEvent(response, 'records-changed', { revision });
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
    if (engine) await engine.syncNow();
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
