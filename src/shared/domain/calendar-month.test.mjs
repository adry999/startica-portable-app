import test from 'node:test';
import assert from 'node:assert/strict';
import { dateOK } from './calendar-month.mjs';

test('dateOK respinge zilele în afara lunii fără să arunce', () => {
  assert.equal(dateOK('2024-05-00'), false);
  assert.equal(dateOK('2024-05-32'), false);
  assert.equal(dateOK('2024-02-31'), false);
  assert.equal(dateOK('2024-02-29'), true);
});
