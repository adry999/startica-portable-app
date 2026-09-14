import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMonthName } from './date-format.mjs';

test('formatMonthName scrie luna în litere, pentru text adresat direct părinților', () => {
  assert.equal(formatMonthName('2026-09'), 'septembrie 2026');
});

test('formatMonthName arată liniuță pentru lună lipsă', () => {
  assert.equal(formatMonthName(''), '—');
});
