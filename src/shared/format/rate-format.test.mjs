import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRate } from './rate-format.mjs';

test('formatRate scrie cursul cu 4 zecimale, nu 2 ca formatMoney', () => {
  assert.equal(formatRate(19.74), '19,7400');
});

test('formatRate rotunjește la 4 zecimale un curs cu mai multe', () => {
  assert.equal(formatRate(19.73521), '19,7352');
});

test('formatRate(null | undefined) rămâne "—"', () => {
  assert.equal(formatRate(null), '—');
  assert.equal(formatRate(undefined), '—');
});
