import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPaymentTenders } from './payment-tenders-format.mjs';

test('formatPaymentTenders listează fiecare metodă cu suma ei, fiecare pe un rând nedespărțit', () => {
  const payment = /** @type {any} */ ({
    id: 'p1',
    amount: 150,
    tenders: [
      { method: 'Cash', amount: 100 },
      { method: 'Card', amount: 50 },
    ],
  });
  assert.equal(
    formatPaymentTenders(payment),
    '<span class="money-line">Cash: 100,00 lei</span><br><span class="money-line">Card: 50,00 lei</span>',
  );
});

test('formatPaymentTenders cade pe metoda unică a achitării fără tenders', () => {
  assert.equal(
    formatPaymentTenders(/** @type {any} */ ({ method: 'Cash', amount: 200 })),
    '<span class="money-line">Cash: 200,00 lei</span>',
  );
});
