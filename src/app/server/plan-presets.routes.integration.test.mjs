import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestApplication } from '#test-support/start-test-application.mjs';

const preset = { id: 'PLAN-1', name: 'Plan Standard', priceEur: 120 };

test('GET /api/plan-presets întoarce lista goală când nu s-a salvat nimic', async t => {
  const { get } = await startTestApplication(t);

  assert.deepEqual(await get('/api/plan-presets'), []);
});

test('POST /api/plan-presets salvează lista și se poate reciti prin GET', async t => {
  const { post, get } = await startTestApplication(t);

  const { status, body } = await post('/api/plan-presets', [
    preset,
    { id: 'PLAN-2', name: 'Plan Premium', priceEur: 200 },
  ]);

  assert.equal(status, 200);
  assert.deepEqual(body, [preset, { id: 'PLAN-2', name: 'Plan Premium', priceEur: 200 }]);
  assert.deepEqual(await get('/api/plan-presets'), body);
});

test('POST /api/plan-presets înlocuiește complet lista existentă', async t => {
  const { post, get } = await startTestApplication(t);
  await post('/api/plan-presets', [preset]);

  const { body } = await post('/api/plan-presets', [{ id: 'PLAN-2', name: 'Plan Premium', priceEur: 200 }]);

  assert.deepEqual(body, [{ id: 'PLAN-2', name: 'Plan Premium', priceEur: 200 }]);
  assert.deepEqual(await get('/api/plan-presets'), body);
});

test('POST /api/plan-presets respinge o presetare fără nume, fără să salveze nimic', async t => {
  const { post, get } = await startTestApplication(t);

  const { status, body } = await post('/api/plan-presets', [{ id: 'PLAN-1', name: '  ', priceEur: 120 }]);

  assert.equal(status, 400);
  assert.match(body.error, /nume/i);
  assert.deepEqual(await get('/api/plan-presets'), []);
});

test('POST /api/plan-presets respinge un preț nepozitiv, fără să salveze nimic', async t => {
  const { post, get } = await startTestApplication(t);

  const { status } = await post('/api/plan-presets', [{ id: 'PLAN-1', name: 'Plan', priceEur: 0 }]);

  assert.equal(status, 400);
  assert.deepEqual(await get('/api/plan-presets'), []);
});

test('POST /api/plan-presets respinge id-uri repetate, fără să salveze nimic', async t => {
  const { post, get } = await startTestApplication(t);

  const { status, body } = await post('/api/plan-presets', [
    { id: 'PLAN-1', name: 'Plan A', priceEur: 100 },
    { id: 'PLAN-1', name: 'Plan B', priceEur: 150 },
  ]);

  assert.equal(status, 400);
  assert.match(body.error, /repetat/i);
  assert.deepEqual(await get('/api/plan-presets'), []);
});

test('POST /api/plan-presets respinge un corp care nu e un array', async t => {
  const { post } = await startTestApplication(t);

  const { status } = await post('/api/plan-presets', { not: 'an array' });

  assert.equal(status, 400);
});
