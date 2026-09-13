import test from 'node:test';
import assert from 'node:assert/strict';
import { findUnassignedPaymentHintsByChild } from './unassigned-payment-hints.mjs';

test('Harta copil → plăți neasociate include doar potrivirile de nume', () => {
  const fee = [{ from: '2025-01', amount: 12000 }];
  const children = [
    { id: 'A', name: 'Florea Mark', feeHistory: fee },
    { id: 'B', name: 'Taburceanu Stefan', feeHistory: fee },
  ];
  const payments = [
    { id: 'P1', sourceName: 'Mark', amount: 12000, allocations: [{ month: '2025-09', amount: 12000 }] },
    { id: 'P2', sourceName: 'achitare gemeni', amount: 12000, allocations: [{ month: '2025-09', amount: 12000 }] },
    { id: 'P3', childId: 'B', sourceName: 'Stefan', amount: 12000, allocations: [{ month: '2025-09', amount: 12000 }] },
  ];
  const byChild = findUnassignedPaymentHintsByChild({ children, payments });
  assert.deepEqual(
    (byChild.get('A') ?? []).map(p => p.id),
    ['P1'],
    'Numele din sursă leagă plata P1 de copilul A.',
  );
  assert.equal(byChild.has('B'), false, 'Plata lui B e deja asociată (are childId), nu apare aici.');
  assert.equal(byChild.size, 1, 'Plata fără potrivire de nume (P2) nu apare pentru nimeni.');
});
