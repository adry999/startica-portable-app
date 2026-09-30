import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatLongDate,
  formatMonthName,
  formatMonthOnly,
  formatMonthAbbrev,
  formatDayLabel,
  formatDateLong,
} from './date-format.mjs';

test('formatMonthName scrie luna în litere, pentru text adresat direct părinților', () => {
  assert.equal(formatMonthName('2026-09'), 'septembrie 2026');
});

test('formatMonthName arată liniuță pentru lună lipsă', () => {
  assert.equal(formatMonthName(''), '—');
});

test('formatMonthOnly scrie doar luna, fără an, pentru antete de coloană', () => {
  assert.equal(formatMonthOnly('2026-09'), 'septembrie');
});

test('formatMonthOnly arată liniuță pentru lună lipsă', () => {
  assert.equal(formatMonthOnly(''), '—');
});

test('formatLongDate scrie data completă, cu ziua săptămânii, pentru titlul rezumatului Telegram', () => {
  assert.equal(formatLongDate('2026-09-15'), 'marți, 15 septembrie 2026');
});

test('formatDayLabel scrie ziua săptămânii și data, fără an, pentru DayStepper', () => {
  assert.equal(formatDayLabel('2026-09-24'), 'Joi, 24 septembrie');
});

test('formatDateLong scrie data fără ziua săptămânii, pentru antetul confirmării de plată', () => {
  assert.equal(formatDateLong('2026-09-24'), '24 septembrie 2026');
});

test('formatDateLong arată liniuță pentru dată lipsă', () => {
  assert.equal(formatDateLong(''), '—');
});

test('formatMonthAbbrev scrie luna scurtă (3 litere), fără an, pentru rândul unei liste', () => {
  assert.equal(formatMonthAbbrev('2026-09-24'), 'Sep');
});

test('formatMonthAbbrev arată gol pentru dată lipsă', () => {
  assert.equal(formatMonthAbbrev(''), '');
});
