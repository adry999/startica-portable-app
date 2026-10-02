import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSyncHttpClient,
  SyncNetworkError,
  SyncRevokedError,
  SyncHttpError,
  SyncIncompatibleError,
} from './sync-http-client.mjs';

/** @param {{ status?: number, body?: unknown }} response */
function jsonResponse({ status = 200, body = {} } = {}) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

// Un fetch fals nu întoarce un Response real (headers, redirected, ...) — clientul
// citește doar status/ok/json, deci semnătura completă nu are ce testa aici.
/** @param {(url: string, options?: any) => Promise<any>} handler @returns {typeof fetch} */
function fakeFetch(handler) {
  return /** @type {typeof fetch} */ (handler);
}

test('clientul refuză http:// spre o adresă care nu e loopback', () => {
  assert.throws(() =>
    createSyncHttpClient({ serverUrl: 'http://sync.exemplu.md', fetch: fakeFetch(async () => jsonResponse()) }),
  );
});

test('clientul acceptă http:// spre 127.0.0.1 sau localhost (dezvoltare)', () => {
  assert.doesNotThrow(() =>
    createSyncHttpClient({ serverUrl: 'http://127.0.0.1:8790', fetch: fakeFetch(async () => jsonResponse()) }),
  );
  assert.doesNotThrow(() =>
    createSyncHttpClient({ serverUrl: 'http://localhost:8790', fetch: fakeFetch(async () => jsonResponse()) }),
  );
});

test('clientul acceptă https:// spre orice adresă', () => {
  assert.doesNotThrow(() =>
    createSyncHttpClient({ serverUrl: 'https://sync.exemplu.md', fetch: fakeFetch(async () => jsonResponse()) }),
  );
});

test('un răspuns 401 devine SyncRevokedError', async () => {
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    token: 'tok',
    fetch: fakeFetch(async () => jsonResponse({ status: 401, body: { error: 'device-revoked' } })),
  });

  await assert.rejects(() => client.status(), SyncRevokedError);
});

test('lipsa răspunsului (fetch aruncă) devine SyncNetworkError', async () => {
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    fetch: fakeFetch(async () => {
      throw new Error('ECONNREFUSED');
    }),
  });

  await assert.rejects(() => client.status(), SyncNetworkError);
});

test('un răspuns de eroare, altul decât 401, devine SyncHttpError cu statusul și mesajul serverului', async () => {
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    fetch: fakeFetch(async () => jsonResponse({ status: 409, body: { error: 'Filiala există deja pe server.' } })),
  });

  await assert.rejects(
    () => client.registerBranch({ id: 'b1', name: 'Filiala', color: 'orange', address: '', createdAt: '' }),
    error =>
      error instanceof SyncHttpError && error.status === 409 && error.message === 'Filiala există deja pe server.',
  );
});

test('pair trimite codul, cheia de instalare, numele și sistemul, fără antet de autorizare', async () => {
  const calls = [];
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    fetch: fakeFetch(async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ body: { deviceId: 'dev-1', token: 'tok', branches: [] } });
    }),
  });

  const result = await client.pair({ code: '123456', name: 'Calculator A', os: 'Windows 11' });

  assert.equal(calls[0].url, 'https://sync.exemplu.md/v1/devices/pair');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { code: '123456', name: 'Calculator A', os: 'Windows 11' });
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.deepEqual(result, { deviceId: 'dev-1', token: 'tok', branches: [] });
});

test('cererile autentificate trimit Authorization: Bearer <token>', async () => {
  const calls = [];
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    token: 'secret-token',
    fetch: fakeFetch(async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ body: { devices: [] } });
    }),
  });

  await client.listDevices();

  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret-token');
});

test('createPairingCode trimite profilul ales (§5.3, 36a)', async () => {
  const calls = [];
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    token: 'tok',
    fetch: fakeFetch(async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ body: { code: '123456', expiresAt: '2026-09-27T09:10:00.000Z' } });
    }),
  });

  await client.createPairingCode({ preset: 'educator' });

  assert.equal(calls[0].url, 'https://sync.exemplu.md/v1/pairing-codes');
  assert.deepEqual(JSON.parse(calls[0].options.body), { profile: { preset: 'educator' } });
});

test('fetchMyProfile cere GET /v1/devices/me', async () => {
  const calls = [];
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    token: 'tok',
    fetch: fakeFetch(async url => {
      calls.push(url);
      return jsonResponse({ body: { profile: { preset: 'complet' } } });
    }),
  });

  const result = await client.fetchMyProfile();

  assert.equal(calls[0], 'https://sync.exemplu.md/v1/devices/me');
  assert.deepEqual(result, { profile: { preset: 'complet' } });
});

test('setDeviceProfile trimite profilul nou pe calea dispozitivului țintă', async () => {
  const calls = [];
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    token: 'tok',
    fetch: fakeFetch(async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ body: { device: { id: 'dev-2' } } });
    }),
  });

  await client.setDeviceProfile('dev-2', { preset: 'bazin' });

  assert.equal(calls[0].url, 'https://sync.exemplu.md/v1/devices/dev-2/profile');
  assert.deepEqual(JSON.parse(calls[0].options.body), { profile: { preset: 'bazin' } });
});

test('pullChanges construiește query-ul cu since și limit', async () => {
  const calls = [];
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    token: 'tok',
    fetch: fakeFetch(async url => {
      calls.push(url);
      return jsonResponse({ body: { changes: [], nextSince: 5, headSeq: 5 } });
    }),
  });

  await client.pullChanges('branch-1', 3, 100);

  assert.equal(calls[0], 'https://sync.exemplu.md/v1/branches/branch-1/changes?since=3&limit=100');
});

test('pushChanges trimite lista de modificări în corp', async () => {
  const calls = [];
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    token: 'tok',
    fetch: fakeFetch(async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ body: { results: [] } });
    }),
  });

  await client.pushChanges('branch-1', [{ changeId: 'c1' }]);

  assert.equal(calls[0].url, 'https://sync.exemplu.md/v1/branches/branch-1/changes');
  assert.deepEqual(JSON.parse(calls[0].options.body), { changes: [{ changeId: 'c1' }] });
});

// setTimeoutFn/clearTimeoutFn false: nu întorc niciodată direct rezultatul lui setTimeout
// (NodeJS.Timeout) — tipul `typeof setTimeout` din createSyncHttpClient cere și proprietatea
// statică __promisify__ a funcției globale, pe care o funcție fake nu o are; un obiect propriu,
// împachetat, evită nepotrivirea de tip și tot anulează temporizatorul real la close().
/**
 * @param {{ setTimeout: number }} timerCalls
 * @returns {any}
 */
function fakeTimers(timerCalls) {
  return {
    setTimeoutFn: (callback, delay) => {
      timerCalls.setTimeout += 1;
      return { handle: setTimeout(callback, 1), unref() {} };
    },
    clearTimeoutFn: fake => clearTimeout(fake?.handle),
  };
}

test('openEvents se reconectează cu backoff după ce fluxul se termină (C-6)', async () => {
  let connectCount = 0;
  const timerCalls = { setTimeout: 0 };
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    token: 'tok',
    fetch: fakeFetch(async () => {
      connectCount += 1;
      const stream = new ReadableStream({
        start(controller) {
          // Fluxul se termină imediat, fără eroare — o repornire a serverului/Caddy.
          controller.close();
        },
      });
      return { body: stream };
    }),
    ...fakeTimers(timerCalls),
  });

  const events = client.openEvents('branch-1', () => {});
  await new Promise(resolve => setTimeout(resolve, 20));
  events.close();

  assert.ok(connectCount >= 2, 'o a doua conectare a avut loc după ce prima s-a terminat');
  assert.ok(timerCalls.setTimeout >= 1, 'reconectarea a fost programată, nu imediată');
});

test('openEvents nu se mai reconectează după close()', async () => {
  let connectCount = 0;
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    token: 'tok',
    fetch: fakeFetch(async () => {
      connectCount += 1;
      throw new Error('ECONNREFUSED');
    }),
    ...fakeTimers({ setTimeout: 0 }),
  });

  const events = client.openEvents('branch-1', () => {});
  await new Promise(resolve => setTimeout(resolve, 5));
  events.close();
  const countAtClose = connectCount;
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.equal(connectCount, countAtClose, 'nicio reconectare nouă după close()');
});

test('un răspuns 426 devine SyncIncompatibleError cu minVersion din corp', async () => {
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    token: 'tok',
    fetch: fakeFetch(async () =>
      jsonResponse({ status: 426, body: { error: 'Versiunea 2.1.0 este prea veche.', minVersion: '2.2.0' } }),
    ),
  });

  await assert.rejects(
    () => client.status(),
    error =>
      error instanceof SyncIncompatibleError &&
      error.minVersion === '2.2.0' &&
      error.message === 'Versiunea 2.1.0 este prea veche.',
  );
});

test('clientVersion (dat) pleacă pe X-Startica-Version la fiecare cerere, inclusiv pair()', async () => {
  const calls = [];
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    clientVersion: '2.2.0',
    fetch: fakeFetch(async (url, options) => {
      calls.push(options);
      return jsonResponse({ body: { deviceId: 'dev-1', token: 'tok', branches: [] } });
    }),
  });

  await client.pair({ setupKey: 'cheie', name: 'A', os: 'Windows 11' });

  assert.equal(calls[0].headers['X-Startica-Version'], '2.2.0');
});

test('fără clientVersion, antetul X-Startica-Version lipsește (comportamentul de azi)', async () => {
  const calls = [];
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    token: 'tok',
    fetch: fakeFetch(async (url, options) => {
      calls.push(options);
      return jsonResponse({ body: { devices: [] } });
    }),
  });

  await client.listDevices();

  assert.equal(calls[0].headers['X-Startica-Version'], undefined);
});

test('openEvents trimite și el X-Startica-Version, când dat', async () => {
  const stream = new ReadableStream({ start: controller => controller.close() });
  const calls = [];
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    token: 'tok',
    clientVersion: '2.2.0',
    fetch: fakeFetch(async (url, options) => {
      calls.push(options);
      return { body: stream };
    }),
    ...fakeTimers({ setTimeout: 0 }),
  });

  const events = client.openEvents('branch-1', () => {});
  await new Promise(resolve => setTimeout(resolve, 10));
  events.close();

  assert.equal(calls[0].headers['X-Startica-Version'], '2.2.0');
});

test('openEvents parsează un flux SSE și cheamă onSeq pentru fiecare eveniment cu seq', async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: change\ndata: {"seq":1}\n\n'));
      controller.enqueue(encoder.encode(': ping\n\n'));
      controller.enqueue(encoder.encode('event: change\ndata: {"seq":2}\n\n'));
      controller.close();
    },
  });
  const client = createSyncHttpClient({
    serverUrl: 'https://sync.exemplu.md',
    token: 'tok',
    fetch: fakeFetch(async () => ({ body: stream })),
  });

  const seen = [];
  const events = client.openEvents('branch-1', seq => seen.push(seq));
  await new Promise(resolve => setTimeout(resolve, 20));
  events.close();

  assert.deepEqual(seen, [1, 2]);
});
