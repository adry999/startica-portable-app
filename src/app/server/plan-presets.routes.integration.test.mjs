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

test('POST /api/plan-presets respinge un preț peste plafon sau cu mai mult de doi zecimali (m24)', async t => {
  const { post, get } = await startTestApplication(t);

  const tooLarge = await post('/api/plan-presets', [{ id: 'PLAN-1', name: 'Plan', priceEur: 100000001 }]);
  assert.equal(tooLarge.status, 400);

  const tooManyDecimals = await post('/api/plan-presets', [{ id: 'PLAN-1', name: 'Plan', priceEur: 120.129 }]);
  assert.equal(tooManyDecimals.status, 400);

  assert.deepEqual(await get('/api/plan-presets'), []);

  const ok = await post('/api/plan-presets', [{ id: 'PLAN-1', name: 'Plan', priceEur: 120.5 }]);
  assert.equal(ok.status, 200);
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

test('POST /api/plan-presets salvează orarul și descrierea opționale și le recitește prin GET', async t => {
  const { post, get } = await startTestApplication(t);

  const withExtras = {
    id: 'PLAN-1',
    name: 'Program mediu',
    priceEur: 350,
    hours: '8:00–17:00',
    description: 'Toate mesele, somn de zi.',
  };
  const { status, body } = await post('/api/plan-presets', [withExtras]);

  assert.equal(status, 200);
  assert.deepEqual(body, [withExtras]);
  assert.deepEqual(await get('/api/plan-presets'), [withExtras]);
});

test('POST /api/plan-presets rămâne compatibilă cu presetări fără orar sau descriere', async t => {
  const { post, get } = await startTestApplication(t);

  const { body } = await post('/api/plan-presets', [preset]);

  assert.deepEqual(body, [preset]);
  assert.equal('hours' in body[0], false);
  assert.equal('description' in body[0], false);
  assert.deepEqual(await get('/api/plan-presets'), [preset]);
});

test('POST /api/plan-presets respinge un orar prea lung, fără să salveze nimic', async t => {
  const { post, get } = await startTestApplication(t);

  const { status } = await post('/api/plan-presets', [{ ...preset, hours: 'x'.repeat(41) }]);

  assert.equal(status, 400);
  assert.deepEqual(await get('/api/plan-presets'), []);
});
