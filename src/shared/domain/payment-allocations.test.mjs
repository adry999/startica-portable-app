import test from 'node:test';
import assert from 'node:assert/strict';
import { allocations, paymentIndex, paymentTenders } from './payment-allocations.mjs';

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

test('paymentIndex însumează achitările pe copil și lună, excluzând arhivate și neasociate', () => {
  const payments = [
    { id: 'p1', childId: 'c1', date: '2026-09-01', archived: false, allocations: [{ month: '2026-09', amount: 300 }] },
    { id: 'p2', childId: 'c1', date: '2026-09-05', archived: false, allocations: [{ month: '2026-09', amount: 200 }] },
    { id: 'p3', childId: 'c1', date: '2026-08-01', archived: false, allocations: [{ month: '2026-08', amount: 100 }] },
    { id: 'p4', childId: 'c1', date: '2026-09-01', archived: true, allocations: [{ month: '2026-09', amount: 999 }] },
    { id: 'p5', childId: '', date: '2026-09-01', archived: false, allocations: [{ month: '2026-09', amount: 999 }] },
  ];

  const index = paymentIndex(payments);
  const months = index.get('c1');
  assert.equal(months.get('2026-09'), 50000);
  assert.equal(months.get('2026-08'), 10000);
  assert.equal(index.has(''), false);
});

test('paymentIndex exclude achitările de după asOf când e specificat, dar le include când lipsește', () => {
  const payments = [
    { id: 'p1', childId: 'c1', date: '2026-08-15', archived: false, allocations: [{ month: '2026-08', amount: 100 }] },
    { id: 'p2', childId: 'c1', date: '2026-09-20', archived: false, allocations: [{ month: '2026-09', amount: 200 }] },
  ];

  const withCutoff = paymentIndex(payments, '2026-09-01');
  assert.equal(withCutoff.get('c1').get('2026-08'), 10000);
  assert.equal(withCutoff.get('c1').has('2026-09'), false);

  const withoutCutoff = paymentIndex(payments);
  assert.equal(withoutCutoff.get('c1').get('2026-08'), 10000);
  assert.equal(withoutCutoff.get('c1').get('2026-09'), 20000);
});
