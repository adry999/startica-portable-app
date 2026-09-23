import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestApplication } from '#test-support/start-test-application.mjs';

const XML_WITH_EUR = `<ValCurs Date="23.09.2026"><Valute ID="47"><CharCode>EUR</CharCode><Value>20.1352</Value></Valute></ValCurs>`;

test('GET /api/exchange-rates întoarce harta goală când nu există nimic salvat', async t => {
  const { get } = await startTestApplication(t);

  const rates = await get('/api/exchange-rates');

  assert.deepEqual(rates, {});
});

test('POST /api/exchange-rates adaugă manual cursul unei zile', async t => {
  const { post, get } = await startTestApplication(t);

  const { status, body } = await post('/api/exchange-rates', { date: '2026-09-20', rate: 20.1 });

  assert.equal(status, 200);
  assert.deepEqual(body, { '2026-09-20': 20.1 });
  assert.deepEqual(await get('/api/exchange-rates'), { '2026-09-20': 20.1 });
});

test('POST /api/exchange-rates suprascrie cursul unei zile deja existente', async t => {
  const { post } = await startTestApplication(t);
  await post('/api/exchange-rates', { date: '2026-09-20', rate: 20.1 });

  const { body } = await post('/api/exchange-rates', { date: '2026-09-20', rate: 20.5 });

  assert.deepEqual(body, { '2026-09-20': 20.5 });
});

test('POST /api/exchange-rates respinge o dată sau un curs invalid', async t => {
  const { post } = await startTestApplication(t);

  const badDate = await post('/api/exchange-rates', { date: 'nu-i dată', rate: 20.1 });
  const badRate = await post('/api/exchange-rates', { date: '2026-09-20', rate: -5 });

  assert.equal(badDate.status, 400);
  assert.equal(badRate.status, 400);
});

test('POST /api/exchange-rates/refresh cere BNM și salvează cursul de azi', async t => {
  const fetch = async () => ({ ok: true, text: async () => XML_WITH_EUR });
  const { post, get } = await startTestApplication(t, { fetch });

  const { status, body } = await post('/api/exchange-rates/refresh', {});

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  const rates = await get('/api/exchange-rates');
  assert.equal(Object.keys(rates).length, 1);
  assert.equal(Object.values(rates)[0], 20.1352);
});

test('POST /api/exchange-rates/refresh întoarce eroare fără să blocheze serverul, când BNM e indisponibil', async t => {
  const fetch = async () => {
    throw new TypeError('fetch failed');
  };
  const { post } = await startTestApplication(t, { fetch });

  const { status, body } = await post('/api/exchange-rates/refresh', {});

  assert.equal(status, 200); // ruta răspunde normal, doar ok:false — nu 500
  assert.equal(body.ok, false);
  assert.equal(typeof body.error, 'string');
});
