import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, formatMoneyInput } from './money-format.mjs';

test('formatMoney fără al doilea argument rămâne MDL, sufix "lei" — comportament neschimbat', () => {
  assert.equal(formatMoney(2000), '2.000,00 lei');
});

test('formatMoney(v, "MDL") e identic cu apelul fără argument', () => {
  assert.equal(formatMoney(2000, 'MDL'), formatMoney(2000));
});

test('formatMoney(v, "EUR") folosește simbolul €, nu "lei"', () => {
  assert.equal(formatMoney(500, 'EUR'), '500,00 €');
});

test('formatMoney(null, "EUR") rămâne "—", ca la MDL', () => {
  assert.equal(formatMoney(null, 'EUR'), '—');
});

test('formatMoneyInput întoarce string numeric brut, fără separator de mii sau monedă', () => {
  assert.equal(formatMoneyInput(1234.5), '1234.50');
});

test('formatMoneyInput rotunjește la 2 zecimale', () => {
  assert.equal(formatMoneyInput(10.005), '10.01');
  assert.equal(formatMoneyInput(10), '10.00');
});
