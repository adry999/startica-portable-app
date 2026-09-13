import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePaymentsByMethod } from './record-list-summary.mjs';

/**
 * @param {Partial<import('#shared/contracts/record-types.mjs').Payment>} overrides
 * @returns {import('#shared/contracts/record-types.mjs').Payment}
 */
function basePayment(overrides = {}) {
  return {
    id: 'p1',
    date: '2026-09-01',
    childId: '',
    month: '',
    method: 'Cash',
    amount: 0,
    allocations: [],
    ...overrides,
  };
}

test('summarizePaymentsByMethod însumează pe metodă, în lei', () => {
  const payments = [
    basePayment({ tenders: [{ method: 'Cash', amount: 100 }] }),
    basePayment({
      tenders: [
        { method: 'Cash', amount: 50 },
        { method: 'Card', amount: 25.5 },
      ],
    }),
    basePayment({ method: 'Transfer', amount: 30 }),
  ];
  assert.deepEqual(summarizePaymentsByMethod(payments), { Cash: 150, Card: 25.5, Transfer: 30, Altele: 0 });
});

test('summarizePaymentsByMethod pune metodele necunoscute la Altele', () => {
  const payments = [basePayment({ tenders: [{ method: 'Cripto', amount: 10 }] })];
  assert.deepEqual(summarizePaymentsByMethod(payments), { Cash: 0, Card: 0, Transfer: 0, Altele: 10 });
});

test('summarizePaymentsByMethod pe listă goală întoarce toate metodele pe zero', () => {
  assert.deepEqual(summarizePaymentsByMethod([]), { Cash: 0, Card: 0, Transfer: 0, Altele: 0 });
});
