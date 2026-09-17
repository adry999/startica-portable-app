import test from 'node:test';
import assert from 'node:assert/strict';
import { dateOK, isoDateOf } from './calendar-month.mjs';

test('dateOK respinge zilele în afara lunii fără să arunce', () => {
  assert.equal(dateOK('2024-05-00'), false);
  assert.equal(dateOK('2024-05-32'), false);
  assert.equal(dateOK('2024-02-31'), false);
  assert.equal(dateOK('2024-02-29'), true);
});

test('isoDateOf folosește componentele locale ale datei, nu UTC', () => {
  assert.equal(isoDateOf(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
});
