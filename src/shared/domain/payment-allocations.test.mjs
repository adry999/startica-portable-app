import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentTenders } from './payment-allocations.mjs';

test('O achitare veche fără componente are o singură metodă', () => {
  const legacy = { id: 'P2', date: '2026-09-08', amount: 200, method: 'Transfer' };
  assert.deepEqual(paymentTenders(legacy), [{ method: 'Transfer', amount: 200 }]);
});
