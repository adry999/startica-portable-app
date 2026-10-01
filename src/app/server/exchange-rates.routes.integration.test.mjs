import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestApplication } from '#test-support/start-test-application.mjs';
import { writeSettingValue } from '#core/server/settings/settings-repository.mjs';
import { today, shiftDays } from '#shared/domain/calendar-month.mjs';

const XML_WITH_EUR = `<ValCurs Date="23.09.2026"><Valute ID="47"><CharCode>EUR</CharCode><Value>20.1352</Value></Valute></ValCurs>`;

test('GET /api/exchange-rates întoarce hărțile goale când nu există nimic salvat', async t => {
  const { get } = await startTestApplication(t);

  const response = await get('/api/exchange-rates');

  assert.deepEqual(response, { rates: {}, sources: {} });
});

test('POST /api/exchange-rates adaugă manual cursul unei zile și marchează provenența „manual”', async t => {
  const { post, get } = await startTestApplication(t);

  const { status, body } = await post('/api/exchange-rates', { date: '2026-09-20', rate: 20.1 });

  assert.equal(status, 200);
  assert.deepEqual(body, { rates: { '2026-09-20': 20.1 }, sources: { '2026-09-20': 'manual' } });
  assert.deepEqual(await get('/api/exchange-rates'), {
    rates: { '2026-09-20': 20.1 },
    sources: { '2026-09-20': 'manual' },
  });
});

test('POST /api/exchange-rates suprascrie cursul unei zile deja existente', async t => {
  const { post } = await startTestApplication(t);
  await post('/api/exchange-rates', { date: '2026-09-20', rate: 20.1 });

  const { body } = await post('/api/exchange-rates', { date: '2026-09-20', rate: 20.5 });

  assert.deepEqual(body.rates, { '2026-09-20': 20.5 });
  assert.deepEqual(body.sources, { '2026-09-20': 'manual' });
});

test('POST /api/exchange-rates respinge o dată sau un curs invalid', async t => {
  const { post } = await startTestApplication(t);

  const badDate = await post('/api/exchange-rates', { date: 'nu-i dată', rate: 20.1 });
  const badRate = await post('/api/exchange-rates', { date: '2026-09-20', rate: -5 });

  assert.equal(badDate.status, 400);
  assert.equal(badRate.status, 400);
});

test('POST /api/exchange-rates/refresh cere BNM și salvează cursul de azi cu provenența „bnm”', async t => {
  const fetch = async () => ({ ok: true, text: async () => XML_WITH_EUR });
  const { post, get } = await startTestApplication(t, { fetch });

  const { status, body } = await post('/api/exchange-rates/refresh', {});

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  const { rates, sources } = await get('/api/exchange-rates');
  assert.equal(Object.keys(rates).length, 1);
  assert.equal(Object.values(rates)[0], 20.1352);
  assert.deepEqual(sources, { [Object.keys(rates)[0]]: 'bnm' });
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

function fakeBnmFetch({ failDates = new Set() } = {}) {
  const calls = [];
  const fetch = async url => {
    const dateParam = new URL(url).searchParams.get('date');
    const [day, month, year] = dateParam.split('.');
    const date = `${year}-${month}-${day}`;
    calls.push(date);
    if (failDates.has(date)) return { ok: false };
    return { ok: true, text: async () => XML_WITH_EUR.replace('20.1352', `${20 + Number(day) / 100}`) };
  };
  return { fetch, calls };
}

test('refreshExchangeRateIfMissing completează retroactiv fiecare zi lipsă, nu doar azi', async t => {
  const { fetch, calls } = fakeBnmFetch();
  const { app } = await startTestApplication(t, { fetch });
  const fourDaysAgo = shiftDays(today(), -4);
  writeSettingValue(app.db, 'exchangeRates', JSON.stringify({ [fourDaysAgo]: 19.5 }));
  writeSettingValue(app.db, 'exchangeRateSources', JSON.stringify({ [fourDaysAgo]: 'manual' }));

  await app.refreshExchangeRateIfMissing();

  const expectedDates = [];
  for (let date = shiftDays(fourDaysAgo, 1); date <= today(); date = shiftDays(date, 1)) expectedDates.push(date);
  assert.deepEqual(calls, expectedDates);
  const rates = JSON.parse(app.db.prepare("SELECT value FROM settings WHERE key='exchangeRates'").get().value);
  assert.equal(rates[fourDaysAgo], 19.5); // ziua deja cunoscută rămâne neschimbată, fără cerere nouă
  assert.equal(Object.keys(rates).length, expectedDates.length + 1);
  const sources = JSON.parse(app.db.prepare("SELECT value FROM settings WHERE key='exchangeRateSources'").get().value);
  assert.equal(sources[fourDaysAgo], 'manual');
  assert.equal(sources[expectedDates.at(-1)], 'bnm');
});

test('refreshExchangeRateIfMissing sare peste o zi fără curs publicat, fără să oprească restul intervalului', async t => {
  const threeDaysAgo = shiftDays(today(), -3);
  const twoDaysAgo = shiftDays(today(), -2);
  const { fetch, calls } = fakeBnmFetch({ failDates: new Set([twoDaysAgo]) });
  const { app } = await startTestApplication(t, { fetch });
  writeSettingValue(app.db, 'exchangeRates', JSON.stringify({ [shiftDays(threeDaysAgo, -1)]: 19.5 }));

  await app.refreshExchangeRateIfMissing();

  assert.deepEqual(calls, [threeDaysAgo, twoDaysAgo, shiftDays(twoDaysAgo, 1), today()]);
  const rates = JSON.parse(app.db.prepare("SELECT value FROM settings WHERE key='exchangeRates'").get().value);
  assert.equal(Object.hasOwn(rates, twoDaysAgo), false);
  assert.equal(Object.hasOwn(rates, threeDaysAgo), true);
  assert.equal(Object.hasOwn(rates, today()), true);
});

test('refreshExchangeRateIfMissing nu face nicio cerere când ultima zi cunoscută e deja azi', async t => {
  const { fetch, calls } = fakeBnmFetch();
  const { app } = await startTestApplication(t, { fetch });
  writeSettingValue(app.db, 'exchangeRates', JSON.stringify({ [today()]: 20.1 }));

  await app.refreshExchangeRateIfMissing();

  assert.deepEqual(calls, []);
});

test('refreshExchangeRateIfMissing, fără niciun istoric, se oprește la limita de completare retroactivă', async t => {
  const { fetch, calls } = fakeBnmFetch();
  const { app } = await startTestApplication(t, { fetch });

  await app.refreshExchangeRateIfMissing();

  assert.equal(calls.length, 31); // 30 de zile în urmă + azi
  assert.equal(calls[0], shiftDays(today(), -30));
  assert.equal(calls.at(-1), today());
});

test('o zi cu curs salvat înainte de acest câmp rămâne fără provenență în hartă (necunoscută, nu presupusă „bnm”)', async t => {
  const { app, get } = await startTestApplication(t);
  // Simulează date vechi: cursul exista deja când n-avea încă cheia de provenență în settings.
  writeSettingValue(app.db, 'exchangeRates', JSON.stringify({ '2026-09-20': 20.1 }));

  const { rates, sources } = await get('/api/exchange-rates');

  assert.deepEqual(rates, { '2026-09-20': 20.1 });
  assert.equal(sources['2026-09-20'], undefined);
});

test('F12: refreshTomorrowRateIfMissing cere doar ziua de mâine, nu intervalul până azi', async t => {
  const { fetch, calls } = fakeBnmFetch();
  const { app } = await startTestApplication(t, { fetch });
  writeSettingValue(app.db, 'exchangeRates', JSON.stringify({ [today()]: 20.1 }));

  await app.refreshTomorrowRateIfMissing();

  assert.deepEqual(calls, [shiftDays(today(), 1)]);
  const rates = JSON.parse(app.db.prepare("SELECT value FROM settings WHERE key='exchangeRates'").get().value);
  assert.equal(Object.hasOwn(rates, shiftDays(today(), 1)), true);
});

test('F12: refreshTomorrowRateIfMissing nu face nicio cerere dacă mâine e deja cunoscută', async t => {
  const { fetch, calls } = fakeBnmFetch();
  const { app } = await startTestApplication(t, { fetch });
  writeSettingValue(app.db, 'exchangeRates', JSON.stringify({ [shiftDays(today(), 1)]: 20.1 }));

  await app.refreshTomorrowRateIfMissing();

  assert.deepEqual(calls, []);
});

test('F12: POST /api/exchange-rates/backfill extinde istoricul înapoi de la cea mai veche zi cunoscută', async t => {
  const { fetch, calls } = fakeBnmFetch();
  const { post } = await startTestApplication(t, { fetch });
  const earliest = shiftDays(today(), -5);
  await post('/api/exchange-rates', { date: earliest, rate: 19.5 });
  calls.length = 0; // golim cererile din POST-ul manual de mai sus (nu face nicio cerere BNM, dar fim siguri)

  const { status, body } = await post('/api/exchange-rates/backfill', { days: 3 });

  assert.equal(status, 200);
  const expectedDates = [shiftDays(earliest, -3), shiftDays(earliest, -2), shiftDays(earliest, -1)];
  assert.deepEqual(calls, expectedDates);
  for (const date of expectedDates) assert.equal(Object.hasOwn(body.rates, date), true);
  assert.equal(body.rates[earliest], 19.5); // ziua deja cunoscută rămâne neschimbată
});

test('F12: POST /api/exchange-rates/backfill respinge un număr de zile invalid', async t => {
  const { post } = await startTestApplication(t);

  const zero = await post('/api/exchange-rates/backfill', { days: 0 });
  const tooMany = await post('/api/exchange-rates/backfill', { days: 91 });
  const notInteger = await post('/api/exchange-rates/backfill', { days: 2.5 });

  assert.equal(zero.status, 400);
  assert.equal(tooMany.status, 400);
  assert.equal(notInteger.status, 400);
});
