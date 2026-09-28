import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSyncServer } from './create-sync-server.mjs';

/** @param {import('node:test').TestContext} t */
function startServer(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'sync-server-integration-'));
  const config = {
    port: 0,
    bind: '127.0.0.1',
    dataDir,
    setupKey: 'cheie-dev',
    setupKeyAlways: false,
    backupHour: 3,
    backupKeep: 14,
    historyDays: 365,
    trustProxy: false,
  };
  const app = createSyncServer({ config, log: () => {}, accessLog: () => {} });
  return new Promise(resolve => {
    app.server.listen(0, '127.0.0.1', () => {
      const { port } = app.server.address();
      const origin = `http://127.0.0.1:${port}`;
      t.after(async () => {
        await app.close();
        rmSync(dataDir, { recursive: true, force: true });
      });
      resolve({ app, origin });
    });
  });
}

/** @param {string} origin @param {string} path @param {{ body?: unknown, token?: string }} [options] */
async function post(origin, path, { body, token } = {}) {
  const response = await fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  return { status: response.status, body: await response.json() };
}

/** @param {string} origin @param {string} path @param {string} [token] */
async function get(origin, path, token) {
  const response = await fetch(origin + path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: response.status, body: await response.json() };
}

test('serverul pornit pe port 0 acceptă pair → push → pull între două tokenuri', async t => {
  const { origin } = await startServer(t);

  const primul = await post(origin, '/v1/devices/pair', {
    body: { setupKey: 'cheie-dev', name: 'Calculator A', os: 'Windows 11' },
  });
  assert.equal(primul.status, 200);
  const tokenA = primul.body.token;

  const filiala = await post(origin, '/v1/branches', {
    token: tokenA,
    body: {
      id: 'branch-1',
      name: 'Filiala principală',
      color: 'orange',
      address: 'Str. 1',
      createdAt: '2026-09-27T08:00:00.000Z',
    },
  });
  assert.equal(filiala.status, 200);
  assert.equal(filiala.body.created, true);

  const cod = await post(origin, '/v1/pairing-codes', { token: tokenA });
  assert.equal(cod.status, 200);
  assert.equal(cod.body.code.length, 6);

  const alDoilea = await post(origin, '/v1/devices/pair', {
    body: { code: cod.body.code, name: 'Calculator B', os: 'macOS' },
  });
  assert.equal(alDoilea.status, 200);
  const tokenB = alDoilea.body.token;

  const push = await post(origin, '/v1/branches/branch-1/changes', {
    token: tokenA,
    body: {
      changes: [
        {
          changeId: 'change-1',
          kind: 'children',
          recordId: 'ID-1',
          baseRevision: 0,
          payload: { id: 'ID-1', name: 'Ana' },
          changedAt: '2026-09-27T09:00:00.000Z',
        },
      ],
    },
  });
  assert.equal(push.status, 200);
  assert.equal(push.body.results[0].status, 'applied');

  const pull = await get(origin, '/v1/branches/branch-1/changes?since=0', tokenB);
  assert.equal(pull.status, 200);
  assert.equal(pull.body.changes.length, 1);
  assert.deepEqual(pull.body.changes[0].payload, { id: 'ID-1', name: 'Ana' });
  assert.equal(pull.body.changes[0].device.id, primul.body.deviceId);
});

test('SSE trimite un eveniment după un push', async t => {
  const { origin } = await startServer(t);

  const dispozitiv = await post(origin, '/v1/devices/pair', {
    body: { setupKey: 'cheie-dev', name: 'Calculator A', os: 'Windows 11' },
  });
  const token = dispozitiv.body.token;
  await post(origin, '/v1/branches', {
    token,
    body: {
      id: 'branch-1',
      name: 'Filiala principală',
      color: 'orange',
      address: 'Str. 1',
      createdAt: '2026-09-27T08:00:00.000Z',
    },
  });

  const eventsResponse = await fetch(origin + '/v1/branches/branch-1/events', {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(eventsResponse.status, 200);
  const reader = eventsResponse.body.getReader();

  const receivedEvent = (async () => {
    let text = '';
    while (!text.includes('event: change')) {
      const { value, done } = await reader.read();
      if (done) throw new Error('fluxul s-a închis fără evenimente');
      text += Buffer.from(value).toString('utf8');
    }
    return text;
  })();

  await post(origin, '/v1/branches/branch-1/changes', {
    token,
    body: {
      changes: [
        {
          changeId: 'change-sse-1',
          kind: 'children',
          recordId: 'ID-1',
          baseRevision: 0,
          payload: { id: 'ID-1' },
          changedAt: '2026-09-27T09:00:00.000Z',
        },
      ],
    },
  });

  const text = await Promise.race([
    receivedEvent,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout așteptând evenimentul SSE')), 5000)),
  ]);
  assert.ok(text.includes('event: change'));
  await reader.cancel();
});
