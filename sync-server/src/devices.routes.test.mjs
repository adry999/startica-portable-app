import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevicesRoutes } from './devices.routes.mjs';
import { completProfile, normalizeProfile } from './profile-policy.mjs';

/** @param {{ devices?: object, pairing?: object, config?: object }} [overrides] */
function buildRoutes(overrides = {}) {
  const devices = {
    countActive: () => 0,
    insert: ({ id, profile }) => ({ id, profile: profile ?? completProfile() }),
    ...overrides.devices,
  };
  const pairing = { consumeCode: () => ({ ok: false, reason: 'not-found' }), ...overrides.pairing };
  const config = { setupKey: 'cheie-corecta', setupKeyAlways: false, ...overrides.config };
  return createDevicesRoutes({
    devices,
    pairing,
    config,
    pairingRateLimiter: { consume: () => true },
    createId: () => 'dev-nou',
    now: () => new Date('2026-09-27T09:00:00.000Z'),
  });
}

/** @param {{ devices?: object, pairing?: object, config?: object }} [overrides] */
function withPairRoute(overrides = {}) {
  return /** @type {import('./router.mjs').RouteDefinition} */ (
    buildRoutes(overrides).routes.find(route => route.method === 'POST' && route.pattern.test('/v1/devices/pair'))
  );
}

/** @param {{ method: 'GET' | 'POST', path: string }} target @param {{ devices?: object, pairing?: object, config?: object }} [overrides] */
function routeFor(target, overrides = {}) {
  return /** @type {import('./router.mjs').RouteDefinition} */ (
    buildRoutes(overrides).routes.find(route => route.method === target.method && route.pattern.test(target.path))
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

test('pair() cu cheia de instalare creează mereu un dispozitiv cu profil Complet (36a: primul calculator)', () => {
  /** @type {unknown} */
  let insertedProfile;
  const pair = withPairRoute({
    devices: { insert: ({ id, profile }) => ((insertedProfile = profile), { id, profile }) },
  });
  pair.handle(requestContext({ body: { setupKey: 'cheie-corecta', name: 'PC', os: 'Windows' }, clientIp: '1.2.3.4' }));
  assert.deepEqual(insertedProfile, completProfile());
});

test('pair() cu un cod care are profil atașat creează dispozitivul cu acel profil (36a)', () => {
  /** @type {unknown} */
  let insertedProfile;
  const pair = withPairRoute({
    devices: { insert: ({ id, profile }) => ((insertedProfile = profile), { id, profile }) },
    pairing: { consumeCode: () => ({ ok: true, createdBy: 'dev-admin', profile: { preset: 'educator' } }) },
  });
  pair.handle(requestContext({ body: { code: '123456', name: 'PC', os: 'Windows' }, clientIp: '1.2.3.4' }));
  assert.equal(/** @type {{ preset: string }} */ (insertedProfile).preset, 'educator');
});

test('pair() cu un cod fără profil ales creează dispozitivul Complet (comportament dinainte de §5.3)', () => {
  /** @type {unknown} */
  let insertedProfile;
  const pair = withPairRoute({
    devices: { insert: ({ id, profile }) => ((insertedProfile = profile), { id, profile }) },
    pairing: { consumeCode: () => ({ ok: true, createdBy: 'dev-admin', profile: null }) },
  });
  pair.handle(requestContext({ body: { code: '123456', name: 'PC', os: 'Windows' }, clientIp: '1.2.3.4' }));
  assert.deepEqual(insertedProfile, completProfile());
});

test('POST /v1/pairing-codes e refuzat dacă dispozitivul care cere nu e Complet', () => {
  const route = routeFor({ method: 'POST', path: '/v1/pairing-codes' });
  const educator = { id: 'dev-1', profile: normalizeProfile({ preset: 'educator' }) };
  assert.throws(
    () => route.handle(/** @type {any} */ ({ params: {}, body: {}, device: educator, url: new URL('http://x/') })),
    /** @param {Error & { status?: number }} error */ error => error.status === 403,
  );
});

test('POST /v1/pairing-codes trece profilul ales mai departe la pairing.createCode', () => {
  /** @type {unknown} */
  let receivedProfile;
  const route = routeFor(
    { method: 'POST', path: '/v1/pairing-codes' },
    { pairing: { createCode: ({ profile }) => ((receivedProfile = profile), { code: '111111', expiresAt: '' }) } },
  );
  const complet = { id: 'dev-1', profile: completProfile() };
  route.handle(
    /** @type {any} */ ({
      params: {},
      body: { profile: { preset: 'bazin' } },
      device: complet,
      url: new URL('http://x/'),
    }),
  );
  assert.deepEqual(receivedProfile, { preset: 'bazin' });
});

test('GET /v1/devices/me întoarce profilul dispozitivului autentificat', () => {
  const route = routeFor({ method: 'GET', path: '/v1/devices/me' });
  const profile = normalizeProfile({ preset: 'bazin' });
  const result = route.handle(
    /** @type {any} */ ({ params: {}, device: { id: 'dev-1', profile }, url: new URL('http://x/') }),
  );
  assert.deepEqual(result, { profile });
});

test('POST /v1/devices/:id/profile e refuzat dacă apelantul nu e Complet', () => {
  const route = routeFor({ method: 'POST', path: '/v1/devices/dev-2/profile' });
  const educator = { id: 'dev-1', profile: normalizeProfile({ preset: 'educator' }) };
  assert.throws(
    () =>
      route.handle(
        /** @type {any} */ ({
          params: { id: 'dev-2' },
          body: { profile: { preset: 'complet' } },
          device: educator,
          url: new URL('http://x/'),
        }),
      ),
    /** @param {Error & { status?: number }} error */ error => error.status === 403,
  );
});

test('POST /v1/devices/:id/profile e refuzat pentru un calculator inexistent', () => {
  const route = routeFor(
    { method: 'POST', path: '/v1/devices/dev-2/profile' },
    { devices: { findById: () => undefined } },
  );
  const complet = { id: 'dev-1', profile: completProfile() };
  assert.throws(
    () =>
      route.handle(
        /** @type {any} */ ({
          params: { id: 'dev-2' },
          body: { profile: { preset: 'educator' } },
          device: complet,
          url: new URL('http://x/'),
        }),
      ),
    /** @param {Error & { status?: number }} error */ error => error.status === 404,
  );
});

test('POST /v1/devices/:id/profile aplică profilul nou prin devices.setProfile', () => {
  /** @type {unknown} */
  let setArgs;
  const route = routeFor(
    { method: 'POST', path: '/v1/devices/dev-2/profile' },
    {
      devices: {
        findById: () => ({ id: 'dev-2' }),
        setProfile: (id, profile) => ((setArgs = { id, profile }), { id, profile: normalizeProfile(profile) }),
      },
    },
  );
  const complet = { id: 'dev-1', profile: completProfile() };
  const result = /** @type {{ device: { profile: { preset: string } } }} */ (
    route.handle(
      /** @type {any} */ ({
        params: { id: 'dev-2' },
        body: { profile: { preset: 'educator' } },
        device: complet,
        url: new URL('http://x/'),
      }),
    )
  );
  assert.deepEqual(setArgs, { id: 'dev-2', profile: { preset: 'educator' } });
  assert.equal(result.device.profile.preset, 'educator');
});

test('GET /v1/devices expune profilul fiecărui dispozitiv listat', () => {
  const profile = normalizeProfile({ preset: 'receptie' });
  const route = routeFor(
    { method: 'GET', path: '/v1/devices' },
    {
      devices: {
        list: () => [
          {
            id: 'dev-2',
            name: 'Recepție',
            os: 'Windows',
            lastSeenAt: '',
            lastBranchId: null,
            revokedAt: null,
            profile,
          },
        ],
      },
    },
  );
  const complet = { id: 'dev-1', profile: completProfile() };
  const result = /** @type {{ devices: { profile: unknown }[] }} */ (
    route.handle(/** @type {any} */ ({ params: {}, device: complet, url: new URL('http://x/') }))
  );
  assert.deepEqual(result.devices[0].profile, profile);
});
