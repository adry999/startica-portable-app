import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fail } from '../errors/domain-error.mjs';
import { RESPONSE_SENT, createRouteDispatcher } from './route-dispatcher.mjs';

/** @returns {import('node:net').AddressInfo} */
const listeningAddress = server => /** @type {import('node:net').AddressInfo} */ (server.address());

function startDispatcherServer(t, routes, options = {}) {
  const dispatchRequest = createRouteDispatcher({
    root: process.cwd(),
    sessionToken: 'test-token',
    routes,
    ...options,
  }).dispatchRequest;
  const server = createServer((request, response) => dispatchRequest(request, response, listeningAddress(server).port));
  t.after(() => new Promise(done => server.close(done)));
  return new Promise(resolveServer =>
    server.listen(0, '127.0.0.1', () =>
      resolveServer({ server, origin: `http://127.0.0.1:${listeningAddress(server).port}` }),
    ),
  );
}

const postJson = (origin, path, token = 'test-token') =>
  fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Startica-Token': token },
    body: '{}',
  });

test('o rută GET necunoscută întoarce 404', async t => {
  const { origin } = await startDispatcherServer(t, []);
  const response = await fetch(origin + '/api/necunoscut');
  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /Pagina nu există/);
});

test('o metodă în afara GET și POST pe o cale necunoscută întoarce 404', async t => {
  const { origin } = await startDispatcherServer(t, []);
  const response = await fetch(origin + '/api/oarecare', { method: 'PUT' });
  assert.equal(response.status, 404);
});

test('o scriere fără token este refuzată cu 403', async t => {
  const { origin } = await startDispatcherServer(t, [
    { method: 'POST', path: '/api/salveaza', handle: () => ({ ok: true }) },
  ]);
  const response = await postJson(origin, '/api/salveaza', '');
  assert.equal(response.status, 403);
});

test('un handler care apelează fail(..., 409) întoarce statusul și mesajul din eroare', async t => {
  const { origin } = await startDispatcherServer(t, [
    {
      method: 'POST',
      path: '/api/conflict',
      handle: () => fail('Conflict de revizie.', 409),
    },
  ]);
  const response = await postJson(origin, '/api/conflict');
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'Conflict de revizie.' });
});

test('o eroare SQLite ajunge ca 500 cu mesaj românesc și se scrie în jurnal', async t => {
  const logged = [];
  const { origin } = await startDispatcherServer(
    t,
    [
      {
        method: 'POST',
        path: '/api/sistem',
        handle: () => {
          throw Object.assign(new Error('database or disk is full'), { code: 'ERR_SQLITE_ERROR', errcode: 13 });
        },
      },
    ],
    { log: message => logged.push(message) },
  );
  const response = await postJson(origin, '/api/sistem');
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: 'Eroare de sistem (disc, fișiere sau internă). Detalii în jurnal.',
  });
  assert.equal(logged.length, 1);
  assert.match(String(logged[0]), /database or disk is full/);
});

test('o eroare de programare (TypeError) ajunge ca 500 cu mesaj românesc și se scrie în jurnal', async t => {
  const logged = [];
  const { origin } = await startDispatcherServer(
    t,
    [
      {
        method: 'POST',
        path: '/api/programare',
        handle: () => {
          throw new TypeError('Cannot read properties of undefined');
        },
      },
    ],
    { log: message => logged.push(message) },
  );
  const response = await postJson(origin, '/api/programare');
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: 'Eroare de sistem (disc, fișiere sau internă). Detalii în jurnal.',
  });
  assert.equal(logged.length, 1);
  assert.match(String(logged[0]), /Cannot read properties of undefined/);
});

test('un fail() de domeniu își păstrează mesajul și statusul, fără să scrie în jurnal', async t => {
  const logged = [];
  const { origin } = await startDispatcherServer(
    t,
    [{ method: 'POST', path: '/api/conflict-domeniu', handle: () => fail('Conflict de revizie.', 409) }],
    { log: message => logged.push(message) },
  );
  const response = await postJson(origin, '/api/conflict-domeniu');
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'Conflict de revizie.' });
  assert.equal(logged.length, 0);
});

test('un handler care întoarce RESPONSE_SENT nu mai primește un al doilea răspuns', async t => {
  const { origin } = await startDispatcherServer(t, [
    {
      method: 'POST',
      path: '/api/raspuns-manual',
      handle: ({ response }) => {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ trimisManual: true }));
        return RESPONSE_SENT;
      },
    },
  ]);
  const response = await postJson(origin, '/api/raspuns-manual');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { trimisManual: true });
});

test('un handler POST asincron este așteptat înainte de a trimite răspunsul', async t => {
  const { origin } = await startDispatcherServer(t, [
    {
      method: 'POST',
      path: '/api/asincron',
      handle: async () => {
        await new Promise(done => setTimeout(done, 5));
        return { gata: true };
      },
    },
  ]);
  const response = await postJson(origin, '/api/asincron');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { gata: true });
});

test('un fail() de domeniu aruncat dintr-un handler asincron își păstrează statusul', async t => {
  const { origin } = await startDispatcherServer(t, [
    {
      method: 'POST',
      path: '/api/asincron-eroare',
      handle: async () => {
        await new Promise(done => setTimeout(done, 5));
        fail('Refuzat asincron.', 409);
      },
    },
  ]);
  const response = await postJson(origin, '/api/asincron-eroare');
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'Refuzat asincron.' });
});

test('un handler GET asincron este așteptat înainte de a trimite răspunsul', async t => {
  const { origin } = await startDispatcherServer(t, [
    {
      method: 'GET',
      path: '/api/asincron-citire',
      handle: async () => {
        await new Promise(done => setTimeout(done, 5));
        return { citit: true };
      },
    },
  ]);
  const response = await fetch(origin + '/api/asincron-citire');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { citit: true });
});
