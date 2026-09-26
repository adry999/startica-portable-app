import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampExchangeRates,
  parseExchangeRates,
  clampExchangeRateSources,
  parseExchangeRateSources,
  eurToMdlRate,
  latestKnownRate,
  convertAmount,
  parseBnmEurRate,
  bnmDateParam,
} from './exchange-rates.mjs';

test('clampExchangeRates păstrează doar chei dată-validă cu valori numerice pozitive', () => {
  assert.deepEqual(
    clampExchangeRates({ '2026-09-20': 20.1, '2026-13-01': 5, bad: 'x', '2026-09-21': -1, '2026-09-22': 0 }),
    { '2026-09-20': 20.1 },
  );
});

test('clampExchangeRates pe intrare nevalidă întoarce harta goală', () => {
  assert.deepEqual(clampExchangeRates(null), {});
  assert.deepEqual(clampExchangeRates('nu-i obiect'), {});
});

test('parseExchangeRates citește JSON valid și cade pe harta goală la JSON stricat', () => {
  assert.deepEqual(parseExchangeRates('{"2026-09-20":20.1}'), { '2026-09-20': 20.1 });
  assert.deepEqual(parseExchangeRates('{stricat'), {});
  assert.deepEqual(parseExchangeRates(undefined), {});
});

test('eurToMdlRate întoarce cursul zilei exacte când există', () => {
  const rates = { '2026-09-20': 20.1, '2026-09-23': 20.1352 };
  assert.equal(eurToMdlRate(rates, '2026-09-23'), 20.1352);
});

test('eurToMdlRate cade pe cel mai recent curs anterior când ziua exactă lipsește', () => {
  const rates = { '2026-09-18': 19.9, '2026-09-20': 20.1 };
  assert.equal(eurToMdlRate(rates, '2026-09-23'), 20.1);
});

test('eurToMdlRate întoarce undefined când nu există niciun curs anterior', () => {
  const rates = { '2026-09-20': 20.1 };
  assert.equal(eurToMdlRate(rates, '2026-09-18'), undefined);
});

test('eurToMdlRate întoarce undefined pe hartă goală', () => {
  assert.equal(eurToMdlRate({}, '2026-09-23'), undefined);
});

test('latestKnownRate întoarce cursul celei mai recente date cunoscute, indiferent de argument', () => {
  const rates = { '2026-09-18': 19.9, '2026-09-23': 20.1352, '2026-09-20': 20.1 };
  assert.equal(latestKnownRate(rates), 20.1352);
});

test('latestKnownRate pe hartă goală întoarce undefined', () => {
  assert.equal(latestKnownRate({}), undefined);
});

test('convertAmount nu convertește când monedele coincid, indiferent de curs', () => {
  assert.equal(convertAmount(500, 'EUR', 'EUR', undefined), 500);
  assert.equal(convertAmount(500, 'MDL', 'MDL', 20.1), 500);
});

test('convertAmount convertește EUR în MDL cu cursul dat', () => {
  assert.equal(convertAmount(500, 'EUR', 'MDL', 20.1352), 10067.6);
});

test('convertAmount convertește MDL în EUR cu cursul dat', () => {
  assert.equal(convertAmount(10067.6, 'MDL', 'EUR', 20.1352), 500);
});

test('convertAmount întoarce null când monedele diferă și cursul lipsește', () => {
  assert.equal(convertAmount(500, 'EUR', 'MDL', undefined), null);
});

test('parseBnmEurRate citește Value din intrarea EUR a răspunsului XML real BNM', () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ValCurs Date="23.09.2026" name="Cursul oficial de schimb">
  <Valute ID="46"><NumCode>840</NumCode><CharCode>USD</CharCode><Nominal>1</Nominal><Name>Dolar SUA</Name><Value>17.8000</Value></Valute>
  <Valute ID="47"><NumCode>978</NumCode><CharCode>EUR</CharCode><Nominal>1</Nominal><Name>Euro</Name><Value>20.1352</Value></Valute>
</ValCurs>`;
  assert.equal(parseBnmEurRate(xml), 20.1352);
});

test('parseBnmEurRate întoarce null când XML-ul nu are o intrare EUR', () => {
  const xml = `<ValCurs Date="23.09.2026"><Valute ID="46"><CharCode>USD</CharCode><Value>17.8</Value></Valute></ValCurs>`;
  assert.equal(parseBnmEurRate(xml), null);
});

test('parseBnmEurRate întoarce null pe text care nu e XML valid', () => {
  assert.equal(parseBnmEurRate('nu-i xml'), null);
  assert.equal(parseBnmEurRate(''), null);
});

test('bnmDateParam transformă YYYY-MM-DD în DD.MM.YYYY, cerut de BNM', () => {
  assert.equal(bnmDateParam('2026-09-23'), '23.09.2026');
});

test('clampExchangeRateSources elimină chei/valori stricate fără să arunce', () => {
  assert.deepEqual(clampExchangeRateSources({ '2026-09-23': 'manual', 'nu-e-dată': 'bnm', '2026-09-24': 'altceva' }), {
    '2026-09-23': 'manual',
  });
  assert.deepEqual(clampExchangeRateSources(null), {});
  assert.deepEqual(clampExchangeRateSources('text'), {});
});

test('parseExchangeRateSources citește JSON valid și cade pe {} la JSON stricat', () => {
  assert.deepEqual(parseExchangeRateSources('{"2026-09-23":"bnm"}'), { '2026-09-23': 'bnm' });
  assert.deepEqual(parseExchangeRateSources('nu-i json'), {});
  assert.deepEqual(parseExchangeRateSources(undefined), {});
});
