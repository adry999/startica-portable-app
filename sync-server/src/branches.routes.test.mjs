import test from 'node:test';
import assert from 'node:assert/strict';
import { createBranchesRoutes } from './branches.routes.mjs';

/** @param {{ branches?: object, devices?: object }} [overrides] */
function withRegisterRoute(overrides = {}) {
  const branches = {
    register: input => ({ branch: { ...input }, created: true }),
    list: () => [],
    ...overrides.branches,
  };
  const devices = { touchLastSeen: () => {}, ...overrides.devices };
  const routes = createBranchesRoutes({ branches, devices, now: () => new Date('2026-09-27T09:00:00.000Z') });
  return /** @type {import('./router.mjs').RouteDefinition} */ (
    routes.routes.find(route => route.method === 'POST' && route.pattern.test('/v1/branches'))
  );
}

test('POST /v1/branches acceptă culorile din paleta aplicației (D-1)', () => {
  const register = withRegisterRoute();
  for (const color of ['orange', 'mint', 'yellow', 'pink']) {
    const result = /** @type {{ branch: { color: string } }} */ (
      register.handle({
        body: { id: `branch-${color}`, name: 'Filiala', color, createdAt: '2026-09-27T08:00:00.000Z' },
        device: { id: 'dev-a' },
      })
    );
    assert.equal(result.branch.color, color);
  }
});

test('POST /v1/branches refuză un cod hex (contractul vechi, incompatibil cu aplicația)', () => {
  const register = withRegisterRoute();
  assert.throws(
    () =>
      register.handle({
        body: { id: 'branch-1', name: 'Filiala', color: '#f5a623', createdAt: '2026-09-27T08:00:00.000Z' },
        device: { id: 'dev-a' },
      }),
    /** @param {Error & { status?: number }} error */ error => error.status === 400,
  );
});

test('POST /v1/branches refuză o culoare necunoscută', () => {
  const register = withRegisterRoute();
  assert.throws(
    () =>
      register.handle({
        body: { id: 'branch-1', name: 'Filiala', color: 'violet', createdAt: '2026-09-27T08:00:00.000Z' },
        device: { id: 'dev-a' },
      }),
    /** @param {Error & { status?: number }} error */ error => error.status === 400,
  );
});
