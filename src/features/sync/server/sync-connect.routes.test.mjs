import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyncConnectRoutes } from './sync-connect.routes.mjs';

const DEVICE = { serverUrl: 'https://sync.exemplu.md', token: 'tok-1' };

/** @param {Partial<Record<string, Function>>} overrides */
function fakeClient(overrides = {}) {
  const calls = { createPairingCode: /** @type {unknown[]} */ ([]), setDeviceProfile: /** @type {unknown[]} */ ([]) };
  const client = {
    createPairingCode: profile => {
      calls.createPairingCode.push(profile);
      return Promise.resolve({ code: '000000', expiresAt: '', serverUrl: DEVICE.serverUrl });
    },
    setDeviceProfile: (deviceId, profile) => {
      calls.setDeviceProfile.push([deviceId, profile]);
      return Promise.resolve({ device: { id: deviceId, profile } });
    },
    ...overrides,
  };
  return { client, calls };
}

function findRoute(routes, method, path) {
  const route = routes.find(r => r.method === method && r.path === path);
  assert.ok(route, `ruta ${method} ${path} nu a fost găsită`);
  return route;
}

test('POST /api/sync/pairing-codes trimite mai departe profilul ales la pasul 1 (36a)', async () => {
  const { client, calls } = fakeClient();
  const routes = createSyncConnectRoutes({
    syncDevice: { read: () => /** @type {any} */ (DEVICE) },
    createHttpClient: () => /** @type {any} */ (client),
    connectService: /** @type {any} */ ({}),
  });
  const route = findRoute(routes, 'POST', '/api/sync/pairing-codes');

  const profile = { preset: 'educator' };
  const result = await route.handle({ body: { profile } });

  assert.deepEqual(calls.createPairingCode, [profile]);
  assert.equal(result.code, '000000');
});

test('POST /api/sync/pairing-codes fără profil (compatibilitate) trimite undefined, nu o eroare', async () => {
  const { client, calls } = fakeClient();
  const routes = createSyncConnectRoutes({
    syncDevice: { read: () => /** @type {any} */ (DEVICE) },
    createHttpClient: () => /** @type {any} */ (client),
    connectService: /** @type {any} */ ({}),
  });
  const route = findRoute(routes, 'POST', '/api/sync/pairing-codes');

  await route.handle({ body: {} });

  assert.deepEqual(calls.createPairingCode, [undefined]);
});

test('POST /api/sync/devices/profile cere deviceId și profile, apoi cheamă setDeviceProfile (36c)', async () => {
  const { client, calls } = fakeClient();
  const routes = createSyncConnectRoutes({
    syncDevice: { read: () => /** @type {any} */ (DEVICE) },
    createHttpClient: () => /** @type {any} */ (client),
    connectService: /** @type {any} */ ({}),
  });
  const route = findRoute(routes, 'POST', '/api/sync/devices/profile');

  const profile = { preset: 'bazin' };
  const result = await route.handle({ body: { deviceId: 'dev-9', profile } });

  assert.deepEqual(calls.setDeviceProfile, [['dev-9', profile]]);
  assert.deepEqual(result.device, { id: 'dev-9', profile });
});

test('POST /api/sync/devices/profile fără deviceId sau fără profile respinge cu 400', async () => {
  const { client } = fakeClient();
  const routes = createSyncConnectRoutes({
    syncDevice: { read: () => /** @type {any} */ (DEVICE) },
    createHttpClient: () => /** @type {any} */ (client),
    connectService: /** @type {any} */ ({}),
  });
  const route = findRoute(routes, 'POST', '/api/sync/devices/profile');

  await assert.rejects(async () => route.handle({ body: { profile: { preset: 'bazin' } } }), /deviceId/);
  await assert.rejects(async () => route.handle({ body: { deviceId: 'dev-9' } }), /Profilul lipsește/);
});
