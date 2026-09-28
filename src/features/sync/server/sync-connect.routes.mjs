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
      handle: () => {
        const { client } = connectedClient();
        return translatingNetworkErrors(() => client.createPairingCode());
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
