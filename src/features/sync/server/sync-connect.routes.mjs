import { fail } from '#core/server/errors/domain-error.mjs';
import { SyncNetworkError, SyncRevokedError } from './sync-http-client.mjs';

/**
 * Rutele de conectare (14b, Task 11-12): conectare/deconectare, cod de pairing, lista
 * de calculatoare și proxy-ul cardului „Sincronizare” către server. Nu țin de o filială
 * anume — construite o singură dată în create-application.mjs, ca `branchRoutes`.
 * @param {{
 *   syncDevice: { read: () => import('../sync.types.d.mts').SyncDeviceFile | null },
 *   createHttpClient: (options: { serverUrl: string, token?: string }) => ReturnType<typeof import('./sync-http-client.mjs').createSyncHttpClient>,
 *   connectService: ReturnType<typeof import('./sync-connect.service.mjs').createSyncConnectService>,
 * }} dependencies
 */
export function createSyncConnectRoutes({ syncDevice, createHttpClient, connectService }) {
  function connectedClient() {
    const device = syncDevice.read();
    if (!device) fail('Acest calculator nu e conectat la niciun server.', 400);
    return { device, client: createHttpClient({ serverUrl: device.serverUrl, token: device.token }) };
  }

  /** @param {() => Promise<unknown>} action */
  async function translatingNetworkErrors(action) {
    try {
      return await action();
    } catch (error) {
      if (error instanceof SyncNetworkError) fail('Serverul de sincronizare nu răspunde. Încearcă din nou.', 503);
      if (error instanceof SyncRevokedError) fail('Acest calculator a fost deconectat de pe server.', 401);
      throw error;
    }
  }

  return [
    {
      method: 'POST',
      path: '/api/sync/connect',
      /** @param {{ body: { serverUrl?: string, code?: string, setupKey?: string, deviceName?: string, os?: string } }} request */
      handle: ({ body }) =>
        translatingNetworkErrors(() =>
          connectService.connect({
            serverUrl: /** @type {string} */ (body?.serverUrl),
            code: body?.code,
            setupKey: body?.setupKey,
            deviceName: /** @type {string} */ (body?.deviceName),
            os: body?.os,
          }),
        ),
    },
    {
      method: 'POST',
      path: '/api/sync/disconnect',
      handle: () => connectService.disconnect(),
    },
    {
      method: 'POST',
      path: '/api/sync/pairing-codes',
      // §5.3 (36a): admin-ul alege profilul (preset sau matrice Personalizat) înainte să genereze
      // codul — `profile` lipsă păstrează comportamentul dinaintea profilurilor (Complet, vezi
      // sync-server/devices.routes.mjs `pair()`). Serverul de sincronizare e cel care verifică,
      // oricum, că apelantul e el însuși Complet (`assertCallerIsComplet`) — nicio gardă în plus
      // aici, doar transportul câmpului.
      /** @param {{ body?: { profile?: unknown } }} request */
      handle: ({ body }) => {
        const { client } = connectedClient();
        return translatingNetworkErrors(() => client.createPairingCode(body?.profile));
      },
    },
    {
      method: 'GET',
      path: '/api/sync/devices',
      handle: () => {
        const { client } = connectedClient();
        return translatingNetworkErrors(() => client.listDevices());
      },
    },
    {
      method: 'POST',
      path: '/api/sync/devices/revoke',
      /** @param {{ body: { deviceId?: string } }} request */
      handle: ({ body }) => {
        if (!body?.deviceId) fail('Trebuie specificat deviceId.', 400);
        const { client } = connectedClient();
        return translatingNetworkErrors(() => client.revokeDevice(/** @type {string} */ (body.deviceId)));
      },
    },
    {
      method: 'POST',
      path: '/api/sync/devices/profile',
      // §5.3 (36c): „Schimbă” din lista de calculatoare — proxy către
      // POST /v1/devices/:id/profile, deja construit pe sync-server/ (doar un dispozitiv Complet
      // poate apela cu succes, `assertCallerIsComplet`).
      /** @param {{ body: { deviceId?: string, profile?: unknown } }} request */
      handle: ({ body }) => {
        if (!body?.deviceId) fail('Trebuie specificat deviceId.', 400);
        if (!body?.profile) fail('Profilul lipsește din cerere.', 400);
        const { client } = connectedClient();
        return translatingNetworkErrors(() =>
          client.setDeviceProfile(/** @type {string} */ (body.deviceId), body.profile),
        );
      },
    },
    {
      method: 'GET',
      path: '/api/sync/server',
      handle: async () => {
        const { client } = connectedClient();
        try {
          const [status, devices, branches] = await Promise.all([
            client.status(),
            client.listDevices(),
            client.listBranches(),
          ]);
          return { ...status, devices: devices.devices, branches: branches.branches, connection: 'online' };
        } catch (error) {
          if (error instanceof SyncNetworkError) return { connection: 'offline', devices: [], branches: [] };
          if (error instanceof SyncRevokedError) fail('Acest calculator a fost deconectat de pe server.', 401);
          throw error;
        }
      },
    },
  ];
}
