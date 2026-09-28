import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApplication } from '#test-support/start-test-application.mjs';
import { createSyncServer } from '#sync-server/create-sync-server.mjs';

const SETUP_KEY = 'cheie-dev-rute';

/** @param {import('node:test').TestContext} t */
async function startRealSyncServer(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'sync-server-routes-integration-'));
  const app = createSyncServer({
    config: {
      port: 0,
      bind: '127.0.0.1',
      dataDir,
      setupKey: SETUP_KEY,
      setupKeyAlways: true,
      backupHour: 3,
      backupKeep: 14,
      historyDays: 365,
      trustProxy: false,
    },
    log: () => {},
  });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const { port } = /** @type {import('node:net').AddressInfo} */ (app.server.address());
  const origin = `http://127.0.0.1:${port}`;
  t.after(async () => {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  });
  return { origin };
}

/** Pentru sync-server/ — Authorization: Bearer <token> (decizia 2 din plan). */
/** @param {string} origin @param {string} path @param {{ body?: unknown, token?: string }} [options] */
async function post(origin, path, { body, token } = {}) {
  const response = await fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  return { status: response.status, body: await response.json() };
}

/** Pentru aplicația locală — antetul X-Startica-Token (request-guards.mjs), nu Bearer. */
/** @param {string} origin @param {string} path @param {{ body?: unknown, token: string }} options */
async function postApp(origin, path, { body, token }) {
  const response = await fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
    body: JSON.stringify(body ?? {}),
  });
  return { status: response.status, body: await response.json() };
}

/** @param {import('node:test').TestContext} t @param {{ home: string, fetch?: typeof fetch }} [options] */
async function startApp(t, { home, fetch: fetchOverride } = {}) {
  const dir = home ?? mkdtempSync(join(tmpdir(), 'sync-routes-app-'));
  const app = createApplication({
    home: dir,
    dataDir: join(dir, 'data'),
    backupDir: join(dir, 'backups'),
    autoBackupIntervalMs: 0,
    ...(fetchOverride ? { fetch: fetchOverride } : {}),
  });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await app.close();
    if (!home) rmSync(dir, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (app.server.address()).port}`;
  const token = (await (await fetch(origin + '/api/session')).json()).token;
  return { app, dir, origin, token };
}

test('status fără sync.json e configured:false', async t => {
  const { origin } = await startApp(t);

  const response = await fetch(origin + '/api/sync/status');
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.configured, false);
  assert.equal(body.pending, 0);
});

test('events trimite status și records-changed după un pull', async t => {
  const { origin: serverOrigin } = await startRealSyncServer(t);

  // Aflăm id-ul filialei implicite pornind aplicația o dată, fără sync.json.
  const home = mkdtempSync(join(tmpdir(), 'sync-routes-events-'));
  const bootstrap = createApplication({
    home,
    dataDir: join(home, 'data'),
    backupDir: join(home, 'backups'),
    autoBackupIntervalMs: 0,
  });
  await new Promise(resolve => bootstrap.server.listen(0, '127.0.0.1', resolve));
  const branchId = bootstrap.activeBranch().id;
  await bootstrap.close();

  const pairA = await post(serverOrigin, '/v1/devices/pair', {
    body: { setupKey: SETUP_KEY, name: 'Calculator A', os: 'Windows 11' },
  });
  await post(serverOrigin, '/v1/branches', {
    token: pairA.body.token,
    body: { id: branchId, name: 'Filiala', color: '#f5a623', address: '', createdAt: new Date().toISOString() },
  });
  writeFileSync(
    join(home, 'sync.json'),
    JSON.stringify({
      version: 1,
      serverUrl: serverOrigin,
      deviceId: pairA.body.deviceId,
      deviceName: 'Calculator A',
      token: pairA.body.token,
      connectedAt: new Date().toISOString(),
    }),
  );

  const { app, origin, token } = await startApp(t, { home });
  // Înregistrat după hook-ul de închidere al startApp (Node rulează t.after în ordinea
  // înregistrării) — altfel s-ar șterge folderul cât baza SQLite e încă deschisă (EBUSY).
  t.after(() => rmSync(home, { recursive: true, force: true }));
  app.startSync();

  const eventsResponse = await fetch(origin + '/api/sync/events');
  assert.equal(eventsResponse.status, 200);
  const reader = /** @type {ReadableStream} */ (eventsResponse.body).getReader();
  /** @type {{ event: string, data: unknown }[]} */
  const received = [];
  let buffer = '';
  const collect = (async () => {
    while (!received.some(entry => entry.event === 'records-changed')) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += Buffer.from(value).toString('utf8');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const eventLine = rawEvent.split('\n').find(line => line.startsWith('event:'));
        const dataLine = rawEvent.split('\n').find(line => line.startsWith('data:'));
        if (eventLine)
          received.push({
            event: eventLine.slice(6).trim(),
            data: dataLine ? JSON.parse(dataLine.slice(5).trim()) : undefined,
          });
      }
    }
  })();

  // O modificare „de pe alt calculator”, trimisă direct pe server.
  const pairB = await post(serverOrigin, '/v1/devices/pair', {
    body: { setupKey: SETUP_KEY, name: 'Calculator B', os: 'macOS' },
  });
  await post(serverOrigin, `/v1/branches/${branchId}/changes`, {
    token: pairB.body.token,
    body: {
      changes: [
        {
          changeId: randomUUID(),
          kind: 'children',
          recordId: 'ID-1',
          baseRevision: 0,
          payload: { id: 'ID-1', name: 'Ana' },
          changedAt: new Date().toISOString(),
        },
      ],
    },
  });

  await postApp(origin, '/api/sync/now', { token });

  await Promise.race([
    collect,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout așteptând evenimentele SSE')), 5000)),
  ]);
  await reader.cancel();

  assert.ok(
    received.some(entry => entry.event === 'status'),
    'primul eveniment e statusul',
  );
  const recordsChanged = received.find(entry => entry.event === 'records-changed');
  assert.ok(recordsChanged, 'a ajuns un records-changed după pull');
});

test('schimbarea filialei oprește motorul vechi și pornește unul pe filiala nouă', async t => {
  const home = mkdtempSync(join(tmpdir(), 'sync-routes-switch-'));

  // Adresă https validă, dar de nefolosit: verificăm doar pornirea/oprirea motorului,
  // nu o sincronizare reală — un fetch fals „offline” evită orice cerere de rețea reală.
  const offlineFetch = async () => {
    throw new Error('rețea indisponibilă în test');
  };
  const bootstrap = createApplication({
    home,
    dataDir: join(home, 'data'),
    backupDir: join(home, 'backups'),
    autoBackupIntervalMs: 0,
    fetch: offlineFetch,
  });
  await new Promise(resolve => bootstrap.server.listen(0, '127.0.0.1', resolve));
  writeFileSync(
    join(home, 'sync.json'),
    JSON.stringify({
      version: 1,
      serverUrl: 'https://sync.exemplu-test.invalid',
      deviceId: 'dev-test',
      deviceName: 'Calculator A',
      token: 'tok',
      connectedAt: new Date().toISOString(),
    }),
  );
  await bootstrap.close();

  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let started = 0;
  let cleared = 0;
  globalThis.setInterval = (...args) => {
    started += 1;
    return originalSetInterval(...args);
  };
  globalThis.clearInterval = (...args) => {
    cleared += 1;
    return originalClearInterval(...args);
  };
  t.after(() => {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  });

  const { app, origin, token } = await startApp(t, { home, fetch: offlineFetch });
  // Înregistrat după hook-ul de închidere al startApp — vezi motivul la testul anterior.
  t.after(() => rmSync(home, { recursive: true, force: true }));
  app.startSync();
  assert.equal(started, 1, 'motorul filialei inițiale a pornit un timer de polling');
  const clearedBefore = cleared;

  const secondBranch = app.registry.add({ name: 'Filiala a doua', color: 'orange', address: '' });
  const secondBranchId = secondBranch.id;

  const select = await postApp(origin, '/api/branches/select', { token, body: { id: secondBranchId } });
  assert.equal(select.status, 200, JSON.stringify(select.body));
  // Comutarea e amânată cu un tick (create-application.mjs) — dăm timp motorului vechi
  // să se oprească și celui nou să pornească înainte de a verifica.
  await new Promise(resolve => setTimeout(resolve, 100));

  // > (nu ===): un flux SSE lăsat deschis de un test anterior (heartbeat-ul lui) se
  // poate închide chiar în această fereastră, adăugând un clearInterval nelegat de
  // comutarea filialei — comportamentul verificat aici e „s-a oprit/pornit cel puțin
  // o dată”, nu numărul exact de temporizatoare din tot procesul de test.
  assert.ok(cleared > clearedBefore, 'motorul filialei vechi a fost oprit');
  assert.ok(started > 1, 'motorul filialei noi a pornit propriul timer');

  const status = await (await fetch(origin + '/api/sync/status')).json();
  assert.equal(status.configured, true, 'filiala nouă vede același sync.json');
});
