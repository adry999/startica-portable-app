import test from 'node:test';
import assert from 'node:assert/strict';
import { amountInWordsRo } from './amount-in-words.mjs';

test('sub 20: forma de bază, fără „de”, 1 la singular cu articol', () => {
  assert.equal(amountInWordsRo(1), 'un leu');
  assert.equal(amountInWordsRo(2), 'doi lei');
  assert.equal(amountInWordsRo(9), 'nouă lei');
  assert.equal(amountInWordsRo(10), 'zece lei');
  assert.equal(amountInWordsRo(11), 'unsprezece lei');
  assert.equal(amountInWordsRo(12), 'doisprezece lei');
  assert.equal(amountInWordsRo(19), 'nouăsprezece lei');
});

test('nu confundă niciodată „un leu” cu forma invariabilă „unu”', () => {
  assert.equal(amountInWordsRo(1), 'un leu');
  assert.notEqual(amountInWordsRo(1), 'unu leu');
});

test('de la 20: mereu „de” + plural, inclusiv pentru compusul „…și unu”', () => {
  assert.equal(amountInWordsRo(20), 'douăzeci de lei');
  assert.equal(amountInWordsRo(21), 'douăzeci și unu de lei');
  assert.equal(amountInWordsRo(22), 'douăzeci și doi de lei');
  assert.equal(amountInWordsRo(29), 'douăzeci și nouă de lei');
  assert.equal(amountInWordsRo(30), 'treizeci de lei');
  assert.equal(amountInWordsRo(99), 'nouăzeci și nouă de lei');
});

test('sute: „o sută”/„n sute”, cu „de” doar când rotund sau ≥20 rămășiță', () => {
  assert.equal(amountInWordsRo(100), 'o sută de lei');
  assert.equal(amountInWordsRo(101), 'o sută unu lei');
  assert.equal(amountInWordsRo(102), 'o sută doi lei');
  assert.equal(amountInWordsRo(112), 'o sută doisprezece lei');
  assert.equal(amountInWordsRo(120), 'o sută douăzeci de lei');
  assert.equal(amountInWordsRo(121), 'o sută douăzeci și unu de lei');
  assert.equal(amountInWordsRo(200), 'două sute de lei');
  assert.equal(amountInWordsRo(999), 'nouă sute nouăzeci și nouă de lei');
});

test('mii: „mie” e feminin — „o mie”, „două mii”, „douăzeci și una de mii”', () => {
  assert.equal(amountInWordsRo(1000), 'o mie de lei');
  assert.equal(amountInWordsRo(2000), 'două mii de lei');
  assert.equal(amountInWordsRo(1200), 'o mie două sute de lei');
  assert.equal(amountInWordsRo(1234), 'o mie două sute treizeci și patru de lei');
  assert.equal(amountInWordsRo(21000), 'douăzeci și una de mii de lei');
  assert.equal(amountInWordsRo(100000), 'o sută de mii de lei');
});

test('milioane: neutrul se comportă ca masculin la singular („un milion”)', () => {
  assert.equal(amountInWordsRo(1000000), 'un milion de lei');
  assert.equal(amountInWordsRo(2000000), 'două milioane de lei');
});

test('compusul terminat în 1, cu grup de mii/milioane înaintea unităţilor, e „unu”/„una” invariabil, nu articol de singular', () => {
  /** @type {[number, string][]} */
  const cases = [
    [1, 'un leu'],
    [2, 'doi lei'],
    [12, 'doisprezece lei'],
    [21, 'douăzeci și unu de lei'],
    [22, 'douăzeci și doi de lei'],
    [101, 'o sută unu lei'],
    [1000, 'o mie de lei'],
    [1001, 'o mie unu lei'],
    [2000, 'două mii de lei'],
    [21001, 'douăzeci și una de mii unu lei'],
    [1000000, 'un milion de lei'],
    [2000001, 'două milioane unu lei'],
  ];
  for (const [amount, expected] of cases) assert.equal(amountInWordsRo(amount), expected, `${amount} lei`);
});

test('bani: aceleași reguli, substantiv „ban”/„bani”', () => {
  assert.equal(amountInWordsRo(1200.5), 'o mie două sute de lei și cincizeci de bani');
  assert.equal(amountInWordsRo(120.05), 'o sută douăzeci de lei și cinci bani');
  assert.equal(amountInWordsRo(0.01), 'zero lei și un ban');
  assert.equal(amountInWordsRo(0.21), 'zero lei și douăzeci și unu de bani');
});

test('fără bani (rotund) nu adaugă „și zero bani”', () => {
  assert.equal(amountInWordsRo(500), 'cinci sute de lei');
  assert.equal(amountInWordsRo(500.0), 'cinci sute de lei');
});

test('rotunjește la ban, ca să evite reziduul binar (ex. 19.1)', () => {
  assert.equal(amountInWordsRo(19.1), 'nouăsprezece lei și zece bani');
});
