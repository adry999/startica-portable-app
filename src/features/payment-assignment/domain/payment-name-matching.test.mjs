import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestChildren } from './payment-name-matching.mjs';

test('Sugestiile de asociere separă potrivirea pe nume de simpla coincidență de sumă', () => {
  const fee = [{ from: '2025-01', amount: 12000 }];
  const children = [
    { id: 'A', name: 'Florea Mark', feeHistory: fee },
    { id: 'B', name: 'Taburceanu Stefan', feeHistory: fee },
    { id: 'C', name: 'Gorea Elizaveta', feeHistory: fee },
  ];
  const empty = new Map();
  const payment = (sourceName, amount = 12000) => ({
    sourceName,
    amount,
    allocations: [{ month: '2025-09', amount }],
  });

  const named = suggestChildren(payment('Mark'), children, empty);
  assert.equal(named[0].id, 'A', 'Numele din sursă decide primul candidat.');
  assert.equal(named[0].nameMatch, true);
  assert.equal(
    named.filter(s => s.nameMatch).length,
    1,
    'Un singur copil are numele potrivit; ceilalți rămân simple coincidențe.',
  );
  assert.ok(
    named.slice(1).every(s => s.nameMatch === false),
    'Ceilalți candidați nu au potrivire de nume.',
  );

  // Diacriticele nu trebuie să împiedice potrivirea.
  assert.equal(suggestChildren(payment('(Gorea Elizaveta)'), children, empty)[0].id, 'C');

  // Text fără nume: pot exista candidați după sumă, dar niciunul nu se poate
  // accepta în masă.
  const noise = suggestChildren(payment('achitare gemeni 6 luni', 72000), children, empty);
  assert.ok(
    noise.every(s => s.nameMatch === false),
    'Cuvintele-zgomot nu produc potriviri de nume.',
  );

  // O lună deja achitată scade scorul față de una neachitată.
  const paidIndex = new Map([['A', new Map([['2025-09', [{ amount: 12000, currency: 'MDL', date: '2025-09-05' }]]])]]);
  const afterPaid = suggestChildren(payment('Mark'), children, paidIndex);
  assert.equal(afterPaid[0].id, 'A', 'Numele rămâne decisiv.');
  assert.ok(!afterPaid[0].reasons.some(r => r.includes('neachitată')));
});
