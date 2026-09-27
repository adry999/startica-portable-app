import test from 'node:test';
import assert from 'node:assert/strict';
import { dateOK, isoDateOf, monthDates } from './calendar-month.mjs';

test('dateOK respinge zilele în afara lunii fără să arunce', () => {
  assert.equal(dateOK('2024-05-00'), false);
  assert.equal(dateOK('2024-05-32'), false);
  assert.equal(dateOK('2024-02-31'), false);
  assert.equal(dateOK('2024-02-29'), true);
});

test('isoDateOf folosește componentele locale ale datei, nu UTC', () => {
  assert.equal(isoDateOf(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
});

test('monthDates dă toate zilele lunii, inclusiv 29 februarie', () => {
  assert.deepEqual(monthDates('2026-09').slice(0, 3), ['2026-09-01', '2026-09-02', '2026-09-03']);
  assert.equal(monthDates('2026-09').length, 30);
  assert.equal(monthDates('2024-02').length, 29);
  assert.equal(monthDates('2024-02').at(-1), '2024-02-29');
});
