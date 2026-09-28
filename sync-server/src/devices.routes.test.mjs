import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevicesRoutes } from './devices.routes.mjs';

/** @param {{ devices?: object, pairing?: object, config?: object }} [overrides] */
function withPairRoute(overrides = {}) {
  const devices = {
    countActive: () => 0,
    insert: ({ id }) => ({ id }),
    ...overrides.devices,
  };
  const pairing = { consumeCode: () => ({ ok: false, reason: 'not-found' }), ...overrides.pairing };
  const config = { setupKey: 'cheie-corecta', setupKeyAlways: false, ...overrides.config };
  const routes = createDevicesRoutes({
    devices,
    pairing,
    config,
    pairingRateLimiter: { consume: () => true },
    createId: () => 'dev-nou',
    now: () => new Date('2026-09-27T09:00:00.000Z'),
  });
  return /** @type {import('./router.mjs').RouteDefinition} */ (
    routes.routes.find(route => route.method === 'POST' && route.pattern.test('/v1/devices/pair'))
  );
}

/** @param {{ body: unknown, clientIp: string }} input @returns {Parameters<import('./router.mjs').RouteDefinition['handle']>[0]} */
function requestContext({ body, clientIp }) {
  return /** @type {any} */ ({ params: {}, body, device: undefined, url: new URL('http://localhost/'), clientIp });
}

test('cheia de instalare corectă e acceptată când nu există dispozitive', () => {
  const pair = withPairRoute();
  const result = /** @type {{ deviceId: string }} */ (
    pair.handle(
      requestContext({
        body: { setupKey: 'cheie-corecta', name: 'PC recepție', os: 'Windows 11' },
        clientIp: '1.2.3.4',
      }),
    )
  );
  assert.equal(result.deviceId, 'dev-nou');
});

test('cheia de instalare greșită e refuzată, chiar cu aceeași lungime (D-7)', () => {
  const pair = withPairRoute();
  assert.throws(
    () =>
      pair.handle(
        requestContext({ body: { setupKey: 'cheie-corectX', name: 'PC', os: 'Windows' }, clientIp: '1.2.3.4' }),
      ),
    /** @param {Error & { status?: number }} error */ error => error.status === 403,
  );
});

test('cheia de instalare cu lungime diferită e refuzată, nu aruncă din cauza timingSafeEqual (D-7)', () => {
  const pair = withPairRoute();
  assert.throws(
    () => pair.handle(requestContext({ body: { setupKey: 'scurt', name: 'PC', os: 'Windows' }, clientIp: '1.2.3.4' })),
    /** @param {Error & { status?: number }} error */ error => error.status === 403,
  );
});

test('cheia de instalare corectă e refuzată dacă există deja un dispozitiv și setupKeyAlways e dezactivat', () => {
  const pair = withPairRoute({ devices: { countActive: () => 1 } });
  assert.throws(
    () =>
      pair.handle(
        requestContext({ body: { setupKey: 'cheie-corecta', name: 'PC', os: 'Windows' }, clientIp: '1.2.3.4' }),
      ),
    /** @param {Error & { status?: number }} error */ error => error.status === 403,
  );
});
