import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBnmEurRate } from './bnm-exchange-rate.mjs';

const XML_WITH_EUR = `<ValCurs Date="23.09.2026"><Valute ID="47"><CharCode>EUR</CharCode><Value>20.1352</Value></Valute></ValCurs>`;

test('fetchBnmEurRate cere URL-ul BNM cu data în format DD.MM.YYYY și întoarce cursul', async () => {
  const calls = [];
  const fetch = async url => {
    calls.push(String(url));
    return { ok: true, text: async () => XML_WITH_EUR };
  };

  const result = await fetchBnmEurRate({ fetch, date: '2026-09-23' });

  assert.deepEqual(result, { rate: 20.1352 });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /get_xml=1/);
  assert.match(calls[0], /date=23\.09\.2026/);
});

test('fetchBnmEurRate întoarce eroare când fetch aruncă (fără internet)', async () => {
  const fetch = async () => {
    throw new TypeError('fetch failed');
  };

  const result = await fetchBnmEurRate({ fetch, date: '2026-09-23' });

  assert.equal('error' in result, true);
});

test('fetchBnmEurRate întoarce eroare pe răspuns HTTP nereușit', async () => {
  const fetch = async () => ({ ok: false, status: 503, text: async () => '' });

  const result = await fetchBnmEurRate({ fetch, date: '2026-09-23' });

  assert.equal('error' in result, true);
});

test('fetchBnmEurRate întoarce eroare când XML-ul nu are o intrare EUR', async () => {
  const fetch = async () => ({ ok: true, text: async () => '<ValCurs></ValCurs>' });

  const result = await fetchBnmEurRate({ fetch, date: '2026-09-23' });

  assert.equal('error' in result, true);
});
