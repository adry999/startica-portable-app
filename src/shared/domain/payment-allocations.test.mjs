import test from 'node:test';
import assert from 'node:assert/strict';
import { allocations, normalizeTenderMethod, paymentIndex, paymentTenders } from './payment-allocations.mjs';
import { normalizeRecord } from './record-schema.mjs';

test('O achitare veche fără componente are o singură metodă', () => {
  const legacy = { id: 'P2', date: '2026-09-08', amount: 200, method: 'Transfer' };
  assert.deepEqual(paymentTenders(legacy), [{ method: 'Transfer', amount: 200 }]);
});

test('normalizeTenderMethod recunoaște alias-uri fără diacritice, case-insensitiv', () => {
  assert.equal(normalizeTenderMethod('numerar'), 'Cash');
  assert.equal(normalizeTenderMethod('Card bancar'), 'Card');
  assert.equal(normalizeTenderMethod('VIRAMENT'), 'Transfer');
  assert.equal(normalizeTenderMethod('transfer bancar'), 'Transfer');
});

test('normalizeTenderMethod lasă neschimbată o metodă cu adevărat necunoscută (B1 — nu ghicește)', () => {
  assert.equal(normalizeTenderMethod('Mixtă'), 'Mixtă');
  assert.equal(normalizeTenderMethod('De verificat'), 'De verificat');
});

test('paymentTenders normalizează metoda unei plăți vechi cu grafie diferită', () => {
  const legacy = { id: 'P3', date: '2026-09-08', amount: 200, method: 'numerar' };
  assert.deepEqual(paymentTenders(legacy), [{ method: 'Cash', amount: 200 }]);
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
    { amount: 500, currency: 'EUR', date: '2026-09-05', service: 'gradinita', fxRate: undefined },
    { amount: 200, currency: 'MDL', date: '2026-09-20', service: 'gradinita', fxRate: undefined },
  ]);
});

test('paymentIndex marchează intrarea cu moneda EUR când plata are amountEur îngheţat, indiferent de currency (rămâne MDL)', () => {
  const frozenPayment = normalizeRecord('payments', {
    id: 'P-FROZEN',
    childId: 'C-2',
    date: '2026-09-10',
    amount: 3000,
    method: 'Cash',
    fxRate: 20,
    fxRateSource: 'manual',
    amountEur: 150,
    allocations: [{ month: '2026-09', amount: 150 }],
  });
  assert.equal(frozenPayment.currency, 'MDL');

  const index = paymentIndex([frozenPayment], '2026-09-30');

  assert.deepEqual(index.get('C-2').get('2026-09'), [
    { amount: 150, currency: 'EUR', date: '2026-09-10', service: 'gradinita', fxRate: 20 },
  ]);
});
