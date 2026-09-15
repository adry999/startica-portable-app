import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLongDate, formatMonthName } from './date-format.mjs';

test('formatMonthName scrie luna în litere, pentru text adresat direct părinților', () => {
  assert.equal(formatMonthName('2026-09'), 'septembrie 2026');
});

test('formatMonthName arată liniuță pentru lună lipsă', () => {
  assert.equal(formatMonthName(''), '—');
});

test('formatLongDate scrie data completă, cu ziua săptămânii, pentru titlul rezumatului Telegram', () => {
  assert.equal(formatLongDate('2026-09-15'), 'marți, 15 septembrie 2026');
});
