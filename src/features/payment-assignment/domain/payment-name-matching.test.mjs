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

test('Un plătitor reținut (payerAliases) apare primul, cu motivul „Plătitor reținut”', () => {
  const fee = [{ from: '2025-01', amount: 12000 }];
  const children = [
    { id: 'A', name: 'Florea Mark', feeHistory: fee },
    { id: 'B', name: 'Taburceanu Stefan', feeHistory: fee },
  ];
  const empty = new Map();
  // Textul din extrasul bancar nu conține niciun nume — doar potrivirea de alias îl leagă de B.
  const payment = { sourceName: 'PLATITOR SRL IBAN MD00XYZ', amount: 12000, allocations: [] };
  const payerAliases = [
    { id: 'PAY-ALIAS-1', alias: 'Platitor SRL IBAN MD00XYZ', childId: 'B', createdAt: '2026-01-01T00:00:00.000Z' },
  ];

  const suggestions = suggestChildren(payment, children, empty, payerAliases);

  assert.equal(suggestions[0].id, 'B', 'Aliasul reținut decide primul candidat, deși A nu are niciun indiciu de nume.');
  assert.equal(suggestions[0].nameMatch, true);
  assert.equal(suggestions[0].reasons[0], 'Plătitor reținut');

  // Textul sursă conține și un cuvânt care se potrivește (întâmplător) numelui lui A, dar textul
  // e exact aliasul reținut al lui B — plătitorul reținut tot domină o simplă potrivire de nume.
  const paymentWithBothHints = { sourceName: 'Mark Textila SRL', amount: 12000, allocations: [] };
  const aliasesForCombinedText = [
    { id: 'PAY-ALIAS-2', alias: 'Mark Textila SRL', childId: 'B', createdAt: '2026-01-01T00:00:00.000Z' },
  ];
  const ranked = suggestChildren(paymentWithBothHints, children, empty, aliasesForCombinedText);
  assert.equal(ranked[0].id, 'B', 'Plătitorul reținut domină o simplă potrivire de nume a altui copil.');
  assert.equal(ranked.find(s => s.id === 'A')?.reasons[0], 'nume în sursă: mark', 'A rămâne doar coincidență de nume.');
});
