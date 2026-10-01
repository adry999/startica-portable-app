import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord } from './record-schema.mjs';
import { obligation, dueDayFor, firstUnpaidMonth, arrears } from './tuition-obligation.mjs';
import { paymentIndex } from './payment-allocations.mjs';

const child = () =>
  normalizeRecord('children', {
    id: 'ID-test',
    name: 'Copil test',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    fee: 2000,
    dueDay: 10,
    feeHistory: [{ from: '2026-09', amount: 2000 }],
  });
const payment = () =>
  normalizeRecord('payments', {
    id: 'PAY-test',
    childId: 'ID-test',
    date: '2026-09-08',
    amount: 3000,
    method: 'Cash',
    allocations: [
      { month: '2026-09', amount: 2000 },
      { month: '2026-10', amount: 500 },
    ],
  });

test('Scadența vine din data contractului, iar orice obligație cunoscută neachitată se notifică', () => {
  // Contract pe 14 => scadent pe 14 în fiecare lună, notificare din 11.
  const child = normalizeRecord('children', {
    id: 'ID-1',
    name: 'Copil',
    status: 'Activ',
    contractDate: '2024-11-14',
    attendanceDate: '2024-12-02',
    dueDay: 10,
    feeHistory: [{ from: '2024-12', amount: 2000 }],
    statusHistory: [{ from: '2024-12', status: 'Activ' }],
  });
  assert.equal(dueDayFor(child), 14, 'Ziua din contract are prioritate față de dueDay.');
  assert.equal(dueDayFor({ dueDay: 10 }), 10, 'Fără contract se folosește dueDay.');
  assert.equal(dueDayFor({}), 10, 'Fără nimic, ziua implicită.');

  const at = day => obligation(child, '2026-09', [], [], day);
  assert.equal(at('2026-09-14').due, '2026-09-14');
  // Orice rest neachitat apare pe listă din prima zi a lunii; doar eticheta
  // arată apropierea de scadență, iar restanțele rămân evidențiate separat
  // (label + late-row).
  for (const [day, label, notify] of [
    ['2026-09-10', 'Nescadent', true],
    ['2026-09-11', 'Scadent în curând', true],
    ['2026-09-14', 'Scadent în curând', true],
    ['2026-09-15', 'Restanță', true],
  ]) {
    assert.equal(at(day).label, label, `eticheta pentru ${day}`);
    assert.equal(at(day).notify, notify, `notificare pentru ${day}`);
  }
  assert.equal(at('2026-09-11').daysToDue, 3);
  assert.equal(at('2026-09-15').daysToDue, -1);

  // Luna scurtă: contract pe 31, februarie are 28.
  assert.equal(obligation({ ...child, contractDate: '2024-01-31' }, '2027-02', [], [], '2027-02-01').due, '2027-02-28');

  // Achitat integral => nu se notifică, oricât de târziu ar fi.
  const paid = [
    normalizeRecord('payments', {
      id: 'PAY-1',
      childId: 'ID-1',
      date: '2026-09-01',
      amount: 2000,
      allocations: [{ month: '2026-09', amount: 2000 }],
    }),
  ];
  assert.equal(obligation(child, '2026-09', paid, [], '2026-09-30').notify, false);
  assert.equal(obligation(child, '2026-09', paid, [], '2026-09-30').label, 'Plătit');

  // Fără elementele care definesc obligația, fișa se verifică manual și nu
  // generează notificări bazate pe presupuneri.
  for (const incomplete of [
    { ...child, feeHistory: [] },
    { ...child, attendanceDate: '' },
    { ...child, status: 'De verificat', statusHistory: [] },
  ]) {
    const result = obligation(incomplete, '2026-09', [], [], '2026-09-30');
    assert.equal(result.label, 'De verificat');
    assert.equal(result.notify, false);
  }

  // Taxa zero este o obligație cunoscută, achitată integral prin definiție.
  const zeroFee = obligation(
    { ...child, feeHistory: [{ from: '2024-12', amount: 0 }] },
    '2026-09',
    [],
    [],
    '2026-09-30',
  );
  assert.equal(zeroFee.label, 'Plătit');
  assert.equal(zeroFee.notify, false);
  // Retras => fără obligație.
  assert.equal(
    obligation({ ...child, statusHistory: [{ from: '2026-08', status: 'Retras' }] }, '2026-09', [], [], '2026-09-30')
      .notify,
    false,
  );
});

test('Încasări după data reală, repartizări, avans, scadență și taxe istorice', () => {
  const childRecord = child(),
    paymentRecord = payment();
  assert.equal(obligation(childRecord, '2026-09', [paymentRecord], [], '2026-09-08').paid, 2000);
  assert.equal(obligation(childRecord, '2026-10', [paymentRecord], [], '2026-09-08').paid, 500);
  // Scadența acestei fișe este ziua 10 (fără dată de contract, se ia dueDay).
  assert.equal(obligation(childRecord, '2026-09', [], [], '2026-09-06').label, 'Nescadent');
  assert.equal(obligation(childRecord, '2026-09', [], [], '2026-09-08').label, 'Scadent în curând');
  assert.equal(obligation(childRecord, '2026-09', [], [], '2026-09-11').label, 'Restanță');
  childRecord.feeHistory.push({ from: '2026-10', amount: 2500 });
  assert.equal(obligation(childRecord, '2026-09', [], []).expected, 2000);
  assert.equal(obligation(childRecord, '2026-10', [], []).expected, 2500);
  assert.equal(obligation({ ...childRecord, feeHistory: [] }, '2026-09', [], []).expected, null);
  assert.equal(obligation({ ...childRecord, attendanceDate: '' }, '2026-09', [], []).label, 'De verificat');
  assert.equal(
    obligation({ ...childRecord, statusHistory: [{ from: '2026-09', status: 'Suspendat' }] }, '2026-09', [], [])
      .expected,
    0,
  );
  assert.equal(obligation({ ...childRecord, withdrawalDate: '2026-09-20' }, '2026-10', [], []).expected, 0);
  assert.equal(obligation({ ...childRecord, dueDay: 31 }, '2027-02', [], []).due, '2027-02-28');
  assert.equal(
    obligation(childRecord, '2026-09', [{ ...paymentRecord, date: '2026-10-01' }], [], '2026-09-08').paid,
    0,
  );
});

test('obligation: taxă EUR, achitare EUR — fără conversie, scade direct', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  const eurPayment = normalizeRecord('payments', {
    id: 'P-EUR',
    childId: 'C-EUR',
    date: '2026-09-10',
    amount: 300,
    currency: 'EUR',
    method: 'Cash',
    allocations: [{ month: '2026-09', amount: 300 }],
  });

  const result = obligation(eurChild, '2026-09', [eurPayment], [], '2026-09-30');

  assert.equal(result.expected, 500);
  assert.equal(result.paid, 300);
  assert.equal(result.rest, 200);
  assert.equal(result.currency, 'EUR');
});

test('obligation: câmpul currency reflectă moneda taxei lunii, MDL implicit pentru fișele fără currency', () => {
  const mdlChild = normalizeRecord('children', {
    id: 'C-MDL',
    name: 'Maria',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 2000 }],
  });
  assert.equal(obligation(mdlChild, '2026-09', [], [], '2026-09-30').currency, 'MDL');
});

test('obligation: moneda urmează intrarea din feeHistory valabilă în luna cerută, nu pe cea mai nouă', () => {
  const switchedChild = normalizeRecord('children', {
    id: 'C-SW',
    name: 'Ana',
    status: 'Activ',
    attendanceDate: '2026-01-01',
    feeHistory: [
      { from: '2026-01', amount: 2000 },
      { from: '2026-09', amount: 100, currency: 'EUR' },
    ],
  });
  assert.equal(obligation(switchedChild, '2026-08', [], [], '2026-09-30').currency, 'MDL');
  assert.equal(obligation(switchedChild, '2026-09', [], [], '2026-09-30').currency, 'EUR');
});

test('obligation: taxă EUR, achitare MDL — convertește MDL în EUR cu cursul zilei achitării', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  const mdlPayment = normalizeRecord('payments', {
    id: 'P-MDL',
    childId: 'C-EUR',
    date: '2026-09-10',
    amount: 2013.52,
    currency: 'MDL',
    method: 'Cash',
    allocations: [{ month: '2026-09', amount: 2013.52 }],
  });
  const rates = { '2026-09-10': 20.1352 };

  const result = obligation(eurChild, '2026-09', [mdlPayment], [], '2026-09-30', null, rates);

  assert.equal(result.expected, 500);
  assert.equal(result.paid, 100);
  assert.equal(result.rest, 400);
});

test('obligation: conversie folosește cursul zilei achitării, nu al zilei "asOf"', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  const mdlPayment = normalizeRecord('payments', {
    id: 'P-MDL',
    childId: 'C-EUR',
    date: '2026-09-05',
    amount: 1000,
    currency: 'MDL',
    method: 'Cash',
    allocations: [{ month: '2026-09', amount: 1000 }],
  });
  // Curs diferit la data plății față de curs "azi" — trebuie folosit cel de la 09-05.
  const rates = { '2026-09-05': 20, '2026-09-30': 25 };

  const result = obligation(eurChild, '2026-09', [mdlPayment], [], '2026-09-30', null, rates);

  assert.equal(result.paid, 50); // 1000 / 20, nu 1000 / 25
});

test('obligation: fără niciun curs cunoscut pentru o conversie necesară, obligația devine "De verificat"', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  const mdlPayment = normalizeRecord('payments', {
    id: 'P-MDL',
    childId: 'C-EUR',
    date: '2026-09-10',
    amount: 1000,
    currency: 'MDL',
    method: 'Cash',
    allocations: [{ month: '2026-09', amount: 1000 }],
  });

  const result = obligation(eurChild, '2026-09', [mdlPayment], [], '2026-09-30', null, {});

  assert.equal(result.expected, null);
  assert.equal(result.paid, null);
  assert.equal(result.rest, null);
  assert.equal(result.label, 'De verificat');
});

test('obligation: copil retras înainte de lună, dar cu o plată neconvertibilă alocată acelei luni — "De verificat" învinge "Fără obligație"', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-01-01',
    withdrawalDate: '2026-08-15',
    feeHistory: [{ from: '2026-01', amount: 500, currency: 'EUR' }],
  });
  const mdlPayment = normalizeRecord('payments', {
    id: 'P-MDL',
    childId: 'C-EUR',
    date: '2026-09-10',
    amount: 1000,
    currency: 'MDL',
    method: 'Cash',
    allocations: [{ month: '2026-09', amount: 1000 }],
  });

  const result = obligation(eurChild, '2026-09', [mdlPayment], [], '2026-09-30', null, {});

  assert.equal(result.expected, null);
  assert.equal(result.paid, null);
  assert.equal(result.rest, null);
  assert.equal(result.credit, null);
  assert.equal(result.label, 'De verificat');
});

test('obligation cu index (calea rapidă) dă același rezultat ca fără index, cu conversie', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  const mdlPayment = normalizeRecord('payments', {
    id: 'P-MDL',
    childId: 'C-EUR',
    date: '2026-09-10',
    amount: 2013.52,
    currency: 'MDL',
    method: 'Cash',
    allocations: [{ month: '2026-09', amount: 2013.52 }],
  });
  const rates = { '2026-09-10': 20.1352 };
  const index = paymentIndex([mdlPayment], '2026-09-30');

  const withIndex = obligation(eurChild, '2026-09', [mdlPayment], [], '2026-09-30', index, rates);
  const withoutIndex = obligation(eurChild, '2026-09', [mdlPayment], [], '2026-09-30', null, rates);

  assert.equal(withIndex.paid, withoutIndex.paid);
  assert.equal(withIndex.paid, 100);
});

test('obligation: fișă existentă fără currency (date vechi) se comportă ca MDL, neschimbat', () => {
  const legacyChild = normalizeRecord('children', {
    id: 'C-OLD',
    name: 'Maria',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 2000 }],
  });
  const legacyPayment = normalizeRecord('payments', {
    id: 'P-OLD',
    childId: 'C-OLD',
    date: '2026-09-10',
    amount: 2000,
    method: 'Cash',
    allocations: [{ month: '2026-09', amount: 2000 }],
  });

  const result = obligation(legacyChild, '2026-09', [legacyPayment], [], '2026-09-30');

  assert.equal(result.expected, 2000);
  assert.equal(result.paid, 2000);
  assert.equal(result.rest, 0);
  assert.equal(result.label, 'Plătit');
});

test('obligation: plată cu curs manual pe achitare — paid este suma îngheţată amountEur, nu recalculul din tabelul de cursuri', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  // Curs manual 20 la achitare => 3000 lei / 20 = 150 €, îngheţat pe plată.
  const manualPayment = normalizeRecord('payments', {
    id: 'P-MANUAL',
    childId: 'C-EUR',
    date: '2026-09-10',
    amount: 3000,
    method: 'Cash',
    fxRate: 20,
    fxRateSource: 'manual',
    amountEur: 150,
    allocations: [{ month: '2026-09', amount: 150 }],
  });
  // Tabelul de cursuri are cu totul altă valoare pentru aceeași zi — nu trebuie folosită.
  const rates = { '2026-09-10': 25 };

  const result = obligation(eurChild, '2026-09', [manualPayment], [], '2026-09-30', null, rates);

  assert.equal(result.paid, 150);
  assert.equal(result.rest, 350);
});

test('obligation: cursul corectat ulterior în tabel nu modifică retroactiv o plată deja îngheţată', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  // Îngheţată la cursul BNM al zilei (20.1352): 3000 / 20.1352 ≈ 148,99 €.
  const frozenPayment = normalizeRecord('payments', {
    id: 'P-FROZEN',
    childId: 'C-EUR',
    date: '2026-09-10',
    amount: 3000,
    method: 'Cash',
    fxRate: 20.1352,
    fxRateSource: 'bnm',
    amountEur: 148.99,
    allocations: [{ month: '2026-09', amount: 148.99 }],
  });
  // Cursul din 12a a fost corectat retroactiv, la o valoare diferită.
  const correctedRates = { '2026-09-10': 22 };

  const result = obligation(eurChild, '2026-09', [frozenPayment], [], '2026-09-30', null, correctedRates);

  assert.equal(result.paid, 148.99);
});

test('obligation: fără curs în tabel pentru ziua plății, o plată cu amountEur îngheţat nu devine "De verificat"', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  const frozenPayment = normalizeRecord('payments', {
    id: 'P-FROZEN',
    childId: 'C-EUR',
    date: '2026-09-10',
    amount: 2000,
    method: 'Cash',
    fxRate: 20,
    fxRateSource: 'bnm',
    amountEur: 100,
    allocations: [{ month: '2026-09', amount: 100 }],
  });

  const result = obligation(eurChild, '2026-09', [frozenPayment], [], '2026-09-30', null, {});

  assert.equal(result.paid, 100);
  assert.equal(result.rest, 400);
  assert.notEqual(result.label, 'De verificat');
});

test('firstUnpaidMonth pentru un copil cu taxă EUR nu sare lunile plătite parțial cu plăți îngheţate', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-08-01',
    feeHistory: [{ from: '2026-08', amount: 500, currency: 'EUR' }],
  });
  // Septembrie e plătit parțial (100 din 500 €) — trebuie propus septembrie, nu octombrie.
  const partialPayment = normalizeRecord('payments', {
    id: 'P-PARTIAL',
    childId: 'C-EUR',
    date: '2026-09-05',
    amount: 2000,
    method: 'Cash',
    fxRate: 20,
    fxRateSource: 'bnm',
    amountEur: 100,
    allocations: [{ month: '2026-09', amount: 100 }],
  });

  assert.equal(firstUnpaidMonth(eurChild, [partialPayment], [], '2026-09-30'), '2026-08');
});

test('firstUnpaidMonth pentru un copil cu taxă EUR: luna plătită integral cu o plată îngheţată e sărită corect', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  const fullPayment = normalizeRecord('payments', {
    id: 'P-FULL',
    childId: 'C-EUR',
    date: '2026-09-05',
    amount: 10000,
    method: 'Cash',
    fxRate: 20,
    fxRateSource: 'bnm',
    amountEur: 500,
    allocations: [{ month: '2026-09', amount: 500 }],
  });

  assert.equal(firstUnpaidMonth(eurChild, [fullPayment], [], '2026-10-05'), '2026-10');
});

test('firstUnpaidMonth caută până la 120 de luni, pentru o frecventare de peste 5 ani', () => {
  // Frecventare din 2020; taxa e 0 până în 2025-06 (luna 66, dincolo de vechea limită de 60), apoi devine reală.
  const unpaidFrom = '2025-06';
  const longChild = normalizeRecord('children', {
    id: 'ID-vechi',
    name: 'Copil vechi',
    status: 'Activ',
    attendanceDate: '2020-01-15',
    dueDay: 10,
    feeHistory: [
      { from: '2020-01', amount: 0 },
      { from: unpaidFrom, amount: 2000 },
    ],
  });
  assert.equal(firstUnpaidMonth(longChild, [], [], '2025-06-20'), unpaidFrom);
});

test('o taxă de bazin se adaugă la obligația lunii ca linie separată și intră în rest', () => {
  const mdlChild = normalizeRecord('children', {
    id: 'C-BAZIN',
    name: 'Maria',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 2000 }],
  });
  const bazinCharge = normalizeRecord('charges', {
    id: 'CHG-bazin-C-BAZIN-2026-09',
    childId: 'C-BAZIN',
    month: '2026-09',
    kind: 'bazin',
    label: 'Bazin septembrie: 6 × 150 lei',
    amount: 900,
    date: '2026-09-30',
  });

  const result = obligation(mdlChild, '2026-09', [], [bazinCharge], '2026-09-30');

  assert.equal(result.expected, 2900);
  assert.equal(result.rest, 2900);
  assert.equal(result.feeAmount, 2000);
  assert.deepEqual(result.lines, [{ kind: 'fee', amount: 2000, currency: 'MDL' }, bazinCharge]);

  // O taxă a altei luni sau a altui copil nu se amestecă.
  const otherMonth = obligation(mdlChild, '2026-10', [], [bazinCharge], '2026-10-30');
  assert.equal(otherMonth.expected, 2000);
});

test('taxa de bazin în lei se convertește în euro la cursul zilei închiderii pentru un copil cu taxă EUR', () => {
  const eurChild = normalizeRecord('children', {
    id: 'C-BAZIN-EUR',
    name: 'Ion',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 500, currency: 'EUR' }],
  });
  const bazinCharge = normalizeRecord('charges', {
    id: 'CHG-bazin-C-BAZIN-EUR-2026-09',
    childId: 'C-BAZIN-EUR',
    month: '2026-09',
    kind: 'bazin',
    label: 'Bazin septembrie: 1 × 201.35 lei',
    amount: 201.35,
    currency: 'MDL',
    date: '2026-09-28',
  });
  // Cursul zilei închiderii (28), nu al lui asOf (30) — la fel ca achitările.
  const rates = { '2026-09-28': 20.135, '2026-09-30': 25 };

  const result = obligation(eurChild, '2026-09', [], [bazinCharge], '2026-09-30', null, rates);

  assert.equal(result.currency, 'EUR');
  assert.equal(result.expected, 510);
  assert.equal(result.rest, 510);
});

test('B3: o plată de Bazin nu scade taxa Grădiniței, și invers, cu sau fără index', () => {
  const mdlChild = normalizeRecord('children', {
    id: 'C-B3',
    name: 'Ana',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 2000 }],
  });
  const bazinCharge = normalizeRecord('charges', {
    id: 'CHG-bazin-C-B3-2026-09',
    childId: 'C-B3',
    month: '2026-09',
    kind: 'bazin',
    label: 'Bazin septembrie: 6 × 150 lei',
    amount: 900,
    date: '2026-09-30',
  });
  const bazinPayment = normalizeRecord('payments', {
    id: 'PAY-bazin-C-B3',
    childId: 'C-B3',
    date: '2026-09-10',
    amount: 900,
    method: 'Cash',
    service: 'bazin',
    allocations: [{ month: '2026-09', amount: 900 }],
  });
  const gradinitaPayment = normalizeRecord('payments', {
    id: 'PAY-gradinita-C-B3',
    childId: 'C-B3',
    date: '2026-09-05',
    amount: 500,
    method: 'Cash',
    service: 'gradinita',
    allocations: [{ month: '2026-09', amount: 500 }],
  });
  const payments = [bazinPayment, gradinitaPayment];
  const charges = [bazinCharge];

  const direct = obligation(mdlChild, '2026-09', payments, charges, '2026-09-30');
  // 2000 (taxă) + 900 (bazin) = 2900 obligație; achitat 500 (grădiniță) + 900 (bazin) = 1400.
  assert.equal(direct.expected, 2900);
  assert.equal(direct.paid, 1400);
  assert.equal(direct.rest, 1500);

  const index = paymentIndex(payments, '2026-09-30');
  const viaIndex = obligation(mdlChild, '2026-09', [], charges, '2026-09-30', index);
  assert.equal(viaIndex.paid, 1400);
  assert.equal(viaIndex.rest, 1500);
});

test('F7: arrears() listează lunile trecute neachitate, strict înainte de `beforeMonth`', () => {
  const c = normalizeRecord('children', {
    id: 'ID-arrears',
    name: 'Copil arrears',
    status: 'Activ',
    attendanceDate: '2026-01-01',
    dueDay: 10,
    feeHistory: [{ from: '2026-01', amount: 1000 }],
  });
  // Ianuarie achitat integral, Februarie neachitat — Martie (beforeMonth) nu intră în listă,
  // chiar dacă ar fi și ea neachitată (F7: doar lunile STRICT trecute sunt „restanță”).
  const jan = normalizeRecord('payments', {
    id: 'PAY-jan',
    childId: 'ID-arrears',
    date: '2026-01-10',
    amount: 1000,
    method: 'Cash',
    allocations: [{ month: '2026-01', amount: 1000 }],
  });
  const list = arrears(c, [jan], [], '2026-03', '2026-03-15');
  assert.deepEqual(list, [{ month: '2026-02', rest: 1000, currency: 'MDL' }]);
});

test('F7: arrears() fără restanțe reale — listă goală', () => {
  const c = normalizeRecord('children', {
    id: 'ID-no-arrears',
    name: 'Copil fără restanțe',
    status: 'Activ',
    attendanceDate: '2026-03-01',
    dueDay: 10,
    feeHistory: [{ from: '2026-03', amount: 1000 }],
  });
  assert.deepEqual(arrears(c, [], [], '2026-03', '2026-03-15'), []);
});
