import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateDownloadRoutes } from './update-download.routes.mjs';

const IDLE_STATUS = {
  updateAvailable: false,
  currentVersion: '2.1.0',
  latestVersion: '2.1.0',
  releaseUrl: null,
  downloadUrl: null,
  sha256: null,
  notes: null,
  checkedAt: null,
  error: null,
};

/** @param {{ downloadService?: object, updateStatus?: () => object }} [overrides] */
function routesFor(overrides = {}) {
  const downloadService = {
    downloadAndVerify: async () => ({ ok: true, file: 'x', version: '2.2.0' }),
    ...overrides.downloadService,
  };
  const updateStatus = overrides.updateStatus ?? (() => IDLE_STATUS);
  return createUpdateDownloadRoutes({ downloadService, updateStatus });
}

/** @param {ReturnType<typeof createUpdateDownloadRoutes>} routes @param {string} path @param {'GET' | 'POST'} method */
function find(routes, path, method) {
  const route = routes.find(candidate => candidate.path === path && candidate.method === method);
  assert.ok(route, `ruta ${method} ${path} nu a fost găsită`);
  return route;
}

test('POST /api/update/download refuză când nu există nicio actualizare disponibilă', async () => {
  const routes = routesFor();
  await assert.rejects(() => Promise.resolve(find(routes, '/api/update/download', 'POST').handle()), /actualizare/);
});

test('POST /api/update/download cheamă downloadAndVerify cu downloadUrl/sha256/latestVersion din status', async () => {
  const calls = [];
  const routes = routesFor({
    updateStatus: () => ({
      ...IDLE_STATUS,
      updateAvailable: true,
      latestVersion: '2.2.0',
      downloadUrl: 'https://exemplu.md/Setup.exe',
      sha256: 'abc',
    }),
    downloadService: {
      downloadAndVerify: async args => {
        calls.push(args);
        return { ok: true, file: '/x', version: '2.2.0' };
      },
    },
  });

  const result = await find(routes, '/api/update/download', 'POST').handle();

  assert.deepEqual(calls[0], { downloadUrl: 'https://exemplu.md/Setup.exe', sha256: 'abc', version: '2.2.0' });
  assert.deepEqual(result, { ok: true, file: '/x', version: '2.2.0' });
});

test('GET /api/update/pending întoarce pendingUpdate() din serviciu', () => {
  const routes = routesFor({ downloadService: { pendingUpdate: () => ({ version: '2.2.0', file: '/x' }) } });

  const result = find(routes, '/api/update/pending', 'GET').handle();

  assert.deepEqual(result, { pending: { version: '2.2.0', file: '/x' } });
});

test('GET /api/update/pending întoarce null când nimic nu e gata', () => {
  const routes = routesFor({ downloadService: { pendingUpdate: () => null } });

  const result = find(routes, '/api/update/pending', 'GET').handle();

  assert.deepEqual(result, { pending: null });
});
