import test from 'node:test';
import assert from 'node:assert/strict';
import { allocations, paymentIndex, paymentTenders } from './payment-allocations.mjs';
import { normalizeRecord } from './record-schema.mjs';

test('O achitare veche fără componente are o singură metodă', () => {
  const legacy = { id: 'P2', date: '2026-09-08', amount: 200, method: 'Transfer' };
  assert.deepEqual(paymentTenders(legacy), [{ method: 'Transfer', amount: 200 }]);
});

test('allocations returnează array-ul explicit când există', () => {
  const payment = { allocations: [{ month: '2026-09', amount: 300 }] };
  assert.deepEqual(allocations(payment), [{ month: '2026-09', amount: 300 }]);
});

test('allocations cade pe o singură intrare când achitarea veche are month+amount', () => {
  const legacy = { month: '2026-09', amount: 400 };
  assert.deepEqual(allocations(legacy), [{ month: '2026-09', amount: 400 }]);
});

test('allocations returnează listă goală pentru un avans neasociat, fără allocations sau month', () => {
  const advance = { amount: 500 };
  assert.deepEqual(allocations(advance), []);
});

test('paymentIndex grupează intrările pe copil și lună fără să le adune, păstrând moneda și data fiecăreia', () => {
  const payments = [
    normalizeRecord('payments', {
      id: 'P-1',
      childId: 'C-1',
      date: '2026-09-05',
      amount: 500,
      currency: 'EUR',
      method: 'Cash',
      allocations: [{ month: '2026-09', amount: 500 }],
    }),
    normalizeRecord('payments', {
      id: 'P-2',
      childId: 'C-1',
      date: '2026-09-20',
      amount: 200,
      currency: 'MDL',
      method: 'Card',
      allocations: [{ month: '2026-09', amount: 200 }],
    }),
  ];

  const index = paymentIndex(payments, '2026-09-30');

  assert.deepEqual(index.get('C-1').get('2026-09'), [
    { amount: 500, currency: 'EUR', date: '2026-09-05' },
    { amount: 200, currency: 'MDL', date: '2026-09-20' },
  ]);
});
