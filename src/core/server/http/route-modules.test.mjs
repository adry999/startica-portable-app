import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRouteModule,
  accessLevelFor,
  OPEN_PATHS,
  OPEN_GET_PATHS,
  STATIC_PATH_MODULE,
} from './route-modules.mjs';
import { TYPES } from '#shared/domain/record-schema.mjs';
import { ACCESS_READ, ACCESS_WRITE, KIND_MODULE } from '#shared/domain/computer-profile.mjs';

test('accessLevelFor: scrierea cere Modifică, citirea cere Vede', () => {
  assert.equal(accessLevelFor(true), ACCESS_WRITE);
  assert.equal(accessLevelFor(false), ACCESS_READ);
});

test('resolveRouteModule: o cale deschisă (sesiune, stare) nu are gardă', () => {
  for (const path of OPEN_PATHS) assert.equal(resolveRouteModule({ method: 'GET', path }), null);
});

test('resolveRouteModule: o cale necunoscută nu are gardă (nu există în rutele reale)', () => {
  assert.equal(resolveRouteModule({ method: 'GET', path: '/api/cale-inexistenta' }), null);
});

test('resolveRouteModule: GET pe o cale statică cere Vede', () => {
  const result = resolveRouteModule({ method: 'GET', path: '/api/personal/state' });
  assert.deepEqual(result, { moduleId: 'personal', write: false, pinExempt: false });
});

test('resolveRouteModule: POST pe o cale statică cere Modifică', () => {
  const result = resolveRouteModule({ method: 'POST', path: '/api/group-delete' });
  assert.deepEqual(result, { moduleId: 'groups', write: true, pinExempt: false });
});

test('resolveRouteModule: o cale cu module alternative (exchange-rates) întoarce lista', () => {
  const result = resolveRouteModule({ method: 'GET', path: '/api/exchange-rates' });
  assert.deepEqual(result, { moduleId: ['admin', 'payments'], write: false, pinExempt: false });
});

test('resolveRouteModule: /api/record rezolvă modulul după body.type', () => {
  const result = resolveRouteModule({ method: 'POST', path: '/api/record', body: { type: 'payments' } });
  assert.deepEqual(result, { moduleId: 'payments', write: true, pinExempt: false });
});

test('resolveRouteModule: /api/record-delete rezolvă modulul după body.type', () => {
  const result = resolveRouteModule({ method: 'POST', path: '/api/record-delete', body: { type: 'children' } });
  assert.deepEqual(result, { moduleId: 'children', write: true, pinExempt: false });
});

test('resolveRouteModule: §7 (36h) rutele PIN-ului însuși sunt pinExempt, ca să nu se blocheze singure', () => {
  assert.deepEqual(resolveRouteModule({ method: 'GET', path: '/api/personal/pin' }), {
    moduleId: 'personal',
    write: false,
    pinExempt: true,
  });
  assert.deepEqual(resolveRouteModule({ method: 'POST', path: '/api/personal/pin/unlock' }), {
    moduleId: 'personal',
    write: true,
    pinExempt: true,
  });
  assert.deepEqual(resolveRouteModule({ method: 'POST', path: '/api/personal/pin/lock' }), {
    moduleId: 'personal',
    write: true,
    pinExempt: true,
  });
});

test('resolveRouteModule: /api/record fără type cunoscut nu are gardă (ruta însăși respinge cererea)', () => {
  assert.equal(resolveRouteModule({ method: 'POST', path: '/api/record', body: { type: 'ceva-inexistent' } }), null);
  assert.equal(resolveRouteModule({ method: 'POST', path: '/api/record', body: {} }), null);
});

test('fiecare tip editabil prin /api/record are un modul în KIND_MODULE', () => {
  for (const kind of TYPES) assert.ok(KIND_MODULE[kind], `lipsește modulul pentru ${kind}`);
});

test('STATIC_PATH_MODULE nu suprapune nicio cale complet deschisă din OPEN_PATHS', () => {
  for (const path of Object.keys(STATIC_PATH_MODULE)) assert.equal(OPEN_PATHS.has(path), false, path);
});

test('resolveRouteModule: /api/branches — GET e deschis, POST cere Administrare', () => {
  assert.equal(resolveRouteModule({ method: 'GET', path: '/api/branches' }), null);
  assert.deepEqual(resolveRouteModule({ method: 'POST', path: '/api/branches' }), {
    moduleId: 'admin',
    write: true,
    pinExempt: false,
  });
});

test('OPEN_GET_PATHS există și în STATIC_PATH_MODULE (altfel POST-ul nu are nicio gardă)', () => {
  for (const path of OPEN_GET_PATHS) assert.ok(STATIC_PATH_MODULE[path], path);
});
