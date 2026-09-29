import test from 'node:test';
import assert from 'node:assert/strict';
import { createChangesRoutes } from './changes.routes.mjs';

/** @param {{ changesService?: object, branches?: object }} [overrides] */
function withRoutes(overrides = {}) {
  const changesService = {
    applyPush: () => ({ results: [] }),
    pull: ({ since, limit }) => ({ changes: [], nextSince: since, headSeq: since, limit }),
    writeSnapshot: () => ({ headSeq: 0 }),
    readSnapshot: () => ({ records: {}, headSeq: 0 }),
    branchHeadSeq: () => 0,
    ...overrides.changesService,
  };
  const branches = /** @type {any} */ ({ findById: () => ({ id: 'branch-1' }), ...overrides.branches });
  const devices = /** @type {any} */ ({ touchLastSeen: () => {} });
  const events = /** @type {any} */ ({ publish: () => {} });
  const routes = createChangesRoutes({
    changesService: /** @type {any} */ (changesService),
    branches,
    devices,
    events,
    now: () => new Date('2026-09-27T09:00:00.000Z'),
  });
  return {
    push: /** @type {import('./router.mjs').RouteDefinition} */ (
      routes.routes.find(route => route.method === 'POST' && route.pattern.test('/v1/branches/branch-1/changes'))
    ),
    pull: /** @type {import('./router.mjs').RouteDefinition} */ (
      routes.routes.find(route => route.method === 'GET' && route.pattern.test('/v1/branches/branch-1/changes'))
    ),
    writeSnapshot: /** @type {import('./router.mjs').RouteDefinition} */ (
      routes.routes.find(route => route.method === 'POST' && route.pattern.test('/v1/branches/branch-1/snapshot'))
    ),
    pullComun: /** @type {import('./router.mjs').RouteDefinition} */ (
      routes.routes.find(route => route.method === 'GET' && route.pattern.test('/v1/branches/comun/changes'))
    ),
  };
}

/** @param {string} url */
function urlWith(url) {
  return new URL(url);
}

test('GET .../changes cu since=abc dă 400, nu NaN (D-8)', () => {
  const { pull } = withRoutes();
  assert.throws(
    () =>
      pull.handle(/** @type {any} */ ({ params: { id: 'branch-1' }, url: urlWith('http://x/?since=abc'), device: {} })),
    /** @param {Error & { status?: number }} error */ error => error.status === 400,
  );
});

test('GET .../changes cu since negativ dă 400', () => {
  const { pull } = withRoutes();
  assert.throws(
    () =>
      pull.handle(/** @type {any} */ ({ params: { id: 'branch-1' }, url: urlWith('http://x/?since=-1'), device: {} })),
    /** @param {Error & { status?: number }} error */ error => error.status === 400,
  );
});

test('GET .../changes fără since folosește 0 (D-8)', () => {
  const { pull } = withRoutes();
  const result = /** @type {{ nextSince: number }} */ (
    pull.handle(/** @type {any} */ ({ params: { id: 'branch-1' }, url: urlWith('http://x/'), device: {} }))
  );
  assert.equal(result.nextSince, 0);
});

test('GET .../changes cu limit=-1 dă 400, nu tot istoricul într-un răspuns (D-8)', () => {
  const { pull } = withRoutes();
  assert.throws(
    () =>
      pull.handle(/** @type {any} */ ({ params: { id: 'branch-1' }, url: urlWith('http://x/?limit=-1'), device: {} })),
    /** @param {Error & { status?: number }} error */ error => error.status === 400,
  );
});

test('GET .../changes cu limit=501 dă 400 (plafonul e 500)', () => {
  const { pull } = withRoutes();
  assert.throws(
    () =>
      pull.handle(/** @type {any} */ ({ params: { id: 'branch-1' }, url: urlWith('http://x/?limit=501'), device: {} })),
    /** @param {Error & { status?: number }} error */ error => error.status === 400,
  );
});

test('POST .../snapshot refuză o intrare cu kind necunoscut (D-8)', () => {
  const { writeSnapshot } = withRoutes();
  assert.throws(
    () =>
      writeSnapshot.handle(
        /** @type {any} */ ({
          params: { id: 'branch-1' },
          body: { entries: [{ kind: 'ceva-inexistent', id: 'ID-1', payload: {}, updatedAt: '2026-09-27T09:00:00Z' }] },
          device: { id: 'dev-a' },
        }),
      ),
    /** @param {Error & { status?: number }} error */ error => error.status === 400,
  );
});

test('POST .../snapshot refuză o intrare fără id (evită 500 pe NOT NULL)', () => {
  const { writeSnapshot } = withRoutes();
  assert.throws(
    () =>
      writeSnapshot.handle(
        /** @type {any} */ ({
          params: { id: 'branch-1' },
          body: { entries: [{ kind: 'children', payload: {}, updatedAt: '2026-09-27T09:00:00Z' }] },
          device: { id: 'dev-a' },
        }),
      ),
    /** @param {Error & { status?: number }} error */ error => error.status === 400,
  );
});

test('POST .../snapshot acceptă o intrare validă', () => {
  const { writeSnapshot } = withRoutes();
  const result = writeSnapshot.handle(
    /** @type {any} */ ({
      params: { id: 'branch-1' },
      body: {
        entries: [{ kind: 'children', id: 'ID-1', payload: { id: 'ID-1' }, updatedAt: '2026-09-27T09:00:00Z' }],
      },
      device: { id: 'dev-a' },
    }),
  );
  assert.deepEqual(result, { headSeq: 0 });
});

test('GET .../changes pentru „comun” nu cere o filială înregistrată (decizia 9, personal-bazin)', () => {
  const { pullComun } = withRoutes({ branches: { findById: () => undefined } });
  const result = /** @type {{ nextSince: number }} */ (
    pullComun.handle(/** @type {any} */ ({ params: { id: 'comun' }, url: urlWith('http://x/'), device: {} }))
  );
  assert.equal(result.nextSince, 0);
});
