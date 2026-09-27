import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRouter, fail, RESPONSE_SENT } from './router.mjs';

/**
 * @param {import('node:test').TestContext} t
 * @param {import('./router.mjs').RouteDefinition[]} routes
 * @param {{ authenticate?: (request: import('node:http').IncomingMessage) => unknown, trustProxy?: boolean }} [options]
 */
async function startRouter(t, routes, options = {}) {
  const router = createRouter({
    routes,
    authenticate:
      options.authenticate ??
      (() => {
        fail('Autentificare necesară.', 401);
      }),
    trustProxy: options.trustProxy,
    log: () => {},
  });
  const server = createServer((request, response) => router.handleRequest(request, response));
  await new Promise(done => server.listen(0, '127.0.0.1', () => done(undefined)));
  t.after(() => new Promise(done => server.close(() => done(undefined))));
  const address = /** @type {import('node:net').AddressInfo} */ (server.address());
  return { origin: `http://127.0.0.1:${address.port}`, server };
}

test('ruta cu autentificare refuză fără Bearer și cu token revocat (401)', async t => {
  const { origin } = await startRouter(
    t,
    [{ method: 'GET', pattern: /^\/protejat$/, auth: true, handle: () => ({ ok: true }) }],
    {
      authenticate: request => {
        if (request.headers.authorization === 'Bearer revocat') fail('Dispozitiv revocat.', 401);
        if (!request.headers.authorization) fail('Autentificare necesară.', 401);
        return { id: 'device-1' };
      },
    },
  );

  const fara = await fetch(origin + '/protejat');
  assert.equal(fara.status, 401);

  const revocat = await fetch(origin + '/protejat', { headers: { authorization: 'Bearer revocat' } });
  assert.equal(revocat.status, 401);

  const bun = await fetch(origin + '/protejat', { headers: { authorization: 'Bearer bun' } });
  assert.equal(bun.status, 200);
  assert.deepEqual(await bun.json(), { ok: true });
});

test('corpul peste limită dă 413', async t => {
  const { origin } = await startRouter(t, [
    { method: 'POST', pattern: /^\/oricare$/, maxBodyBytes: 10, handle: ({ body }) => body },
  ]);

  const response = await fetch(origin + '/oricare', {
    method: 'POST',
    body: JSON.stringify({ text: 'un corp mult mai lung decât zece octeți' }),
  });
  assert.equal(response.status, 413);
});

test('extrage parametrii din cale și îi transmite handlerului', async t => {
  const { origin } = await startRouter(t, [
    {
      method: 'GET',
      pattern: /^\/v1\/branches\/(?<id>[^/]+)$/,
      handle: ({ params }) => ({ id: params.id }),
    },
  ]);

  const response = await fetch(origin + '/v1/branches/abc-123');
  assert.deepEqual(await response.json(), { id: 'abc-123' });
});

test('o cale necunoscută dă 404, iar handlerul care răspunde direct nu mai e suprascris', async t => {
  const { origin } = await startRouter(t, [
    {
      method: 'GET',
      pattern: /^\/evenimente$/,
      handle: ({ response }) => {
        response.writeHead(200, { 'Content-Type': 'text/plain' });
        response.end('flux');
        return RESPONSE_SENT;
      },
    },
  ]);

  const necunoscuta = await fetch(origin + '/nu-exista');
  assert.equal(necunoscuta.status, 404);

  const flux = await fetch(origin + '/evenimente');
  assert.equal(await flux.text(), 'flux');
});
