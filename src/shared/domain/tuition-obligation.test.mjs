import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord } from './record-schema.mjs';
import { obligation, dueDayFor, firstUnpaidMonth } from './tuition-obligation.mjs';

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

  const at = day => obligation(child, '2026-09', [], day);
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
  assert.equal(obligation({ ...child, contractDate: '2024-01-31' }, '2027-02', [], '2027-02-01').due, '2027-02-28');

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
  assert.equal(obligation(child, '2026-09', paid, '2026-09-30').notify, false);
  assert.equal(obligation(child, '2026-09', paid, '2026-09-30').label, 'Plătit');

  // Fără elementele care definesc obligația, fișa se verifică manual și nu
  // generează notificări bazate pe presupuneri.
  for (const incomplete of [
    { ...child, feeHistory: [] },
    { ...child, attendanceDate: '' },
    { ...child, status: 'De verificat', statusHistory: [] },
  ]) {
    const result = obligation(incomplete, '2026-09', [], '2026-09-30');
    assert.equal(result.label, 'De verificat');
    assert.equal(result.notify, false);
  }

  // Taxa zero este o obligație cunoscută, achitată integral prin definiție.
  const zeroFee = obligation({ ...child, feeHistory: [{ from: '2024-12', amount: 0 }] }, '2026-09', [], '2026-09-30');
  assert.equal(zeroFee.label, 'Plătit');
  assert.equal(zeroFee.notify, false);
  // Retras => fără obligație.
  assert.equal(
    obligation({ ...child, statusHistory: [{ from: '2026-08', status: 'Retras' }] }, '2026-09', [], '2026-09-30')
      .notify,
    false,
  );
});

test('Încasări după data reală, repartizări, avans, scadență și taxe istorice', () => {
  const childRecord = child(),
    paymentRecord = payment();
  assert.equal(obligation(childRecord, '2026-09', [paymentRecord], '2026-09-08').paid, 2000);
  assert.equal(obligation(childRecord, '2026-10', [paymentRecord], '2026-09-08').paid, 500);
  // Scadența acestei fișe este ziua 10 (fără dată de contract, se ia dueDay).
  assert.equal(obligation(childRecord, '2026-09', [], '2026-09-06').label, 'Nescadent');
  assert.equal(obligation(childRecord, '2026-09', [], '2026-09-08').label, 'Scadent în curând');
  assert.equal(obligation(childRecord, '2026-09', [], '2026-09-11').label, 'Restanță');
  childRecord.feeHistory.push({ from: '2026-10', amount: 2500 });
  assert.equal(obligation(childRecord, '2026-09', []).expected, 2000);
  assert.equal(obligation(childRecord, '2026-10', []).expected, 2500);
  assert.equal(obligation({ ...childRecord, feeHistory: [] }, '2026-09', []).expected, null);
  assert.equal(obligation({ ...childRecord, attendanceDate: '' }, '2026-09', []).label, 'De verificat');
  assert.equal(
    obligation({ ...childRecord, statusHistory: [{ from: '2026-09', status: 'Suspendat' }] }, '2026-09', []).expected,
    0,
  );
  assert.equal(obligation({ ...childRecord, withdrawalDate: '2026-09-20' }, '2026-10', []).expected, 0);
  assert.equal(obligation({ ...childRecord, dueDay: 31 }, '2027-02', []).due, '2027-02-28');
  assert.equal(obligation(childRecord, '2026-09', [{ ...paymentRecord, date: '2026-10-01' }], '2026-09-08').paid, 0);
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
  assert.equal(firstUnpaidMonth(longChild, [], '2025-06-20'), unpaidFrom);
});
