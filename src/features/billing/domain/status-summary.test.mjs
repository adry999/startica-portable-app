import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { evaluateChildrenForMonth } from './month-evaluation.mjs';
import { evaluateChildrenForSchoolYear } from './school-year-evaluation.mjs';
import { toMdlToday, summarizeMonthStatus, heatCellKind, summarizeSchoolYear } from './status-summary.mjs';

const child = (overrides = {}) =>
  normalizeRecord('children', {
    id: 'C-1',
    name: 'Copil Test',
    status: 'Activ',
    attendanceDate: '2026-01-10',
    contractDate: '2026-01-10',
    feeHistory: [{ from: '2026-01', amount: 1000 }],
    ...overrides,
  });

const payment = (overrides = {}) =>
  normalizeRecord('payments', {
    id: 'P-1',
    childId: 'C-1',
    date: '2026-09-05',
    amount: 400,
    method: 'Cash',
    allocations: [{ month: '2026-09', amount: 400 }],
    ...overrides,
  });

test('toMdlToday: lei neschimbat, EUR la cel mai recent curs, null (nu 1:1) fără niciun curs', () => {
  assert.equal(toMdlToday(100, 'MDL', { '2026-09-01': 20 }), 100);
  assert.equal(toMdlToday(100, 'EUR', { '2026-08-01': 19, '2026-09-01': 20 }), 2000);
  // m22: fără niciun curs, 1:1 arăta 100 € ca 100 lei — o eroare de ~20x mascată drept număr normal.
  assert.equal(toMdlToday(100, 'EUR', {}), null);
});

test('summarizeMonthStatus: de încasat, încasat, restanțe și numărul copiilor cu taxă, pe toată luna', () => {
  const records = /** @type {any} */ ({
    children: [
      child(), // restanță 600 (scadent pe 10, asOf 27)
      child({ id: 'C-2', feeHistory: [{ from: '2026-01', amount: 500 }] }), // restanță 500
      child({ id: 'C-3', feeHistory: [] }), // De verificat — nu intră
      child({ id: 'C-4', withdrawalDate: '2026-06-30', status: 'Retras' }), // Fără obligație
    ],
    payments: [payment()],
  });
  const summary = summarizeMonthStatus(evaluateChildrenForMonth(records, '2026-09', '2026-09-27'));
  assert.equal(summary.expected, 1500);
  assert.equal(summary.paid, 400);
  assert.equal(summary.paidShare, 400 / 1500);
  assert.equal(summary.owingChildren, 2);
  assert.equal(summary.overdueChildren, 2);
  assert.equal(summary.overdue, 1100);
});

test('summarizeMonthStatus convertește copiii cu taxă EUR la cursul cel mai recent', () => {
  const records = /** @type {any} */ ({
    children: [child({ feeHistory: [{ from: '2026-01', amount: 100, currency: 'EUR' }] })],
    payments: [],
  });
  const summary = summarizeMonthStatus(evaluateChildrenForMonth(records, '2026-09', '2026-09-27'), {
    '2026-09-25': 20,
  });
  assert.equal(summary.expected, 2000);
  assert.equal(summary.overdue, 2000);
});

test('summarizeMonthStatus: un copil EUR fără niciun curs cunoscut nu intră 1:1 în sume, dar ridică hasMissingRate', () => {
  const records = /** @type {any} */ ({
    children: [child({ feeHistory: [{ from: '2026-01', amount: 100, currency: 'EUR' }] })],
    payments: [],
  });
  const summary = summarizeMonthStatus(evaluateChildrenForMonth(records, '2026-09', '2026-09-27'), {});
  assert.equal(summary.hasMissingRate, true);
  assert.equal(summary.expected, 0);
  assert.equal(summary.overdue, 0);
});

test('summarizeMonthStatus: bara Încasat se oprește la 100% când s-a plătit peste taxă', () => {
  const records = /** @type {any} */ ({
    children: [child()],
    payments: [payment({ amount: 1200, allocations: [{ month: '2026-09', amount: 1200 }] })],
  });
  const summary = summarizeMonthStatus(evaluateChildrenForMonth(records, '2026-09', '2026-09-27'));
  assert.equal(summary.paidShare, 1);
});

test('heatCellKind clasifică o lună după rest, achitat și scadență', () => {
  const base = { expected: 1000, due: '2026-09-10', currency: 'MDL' };
  assert.equal(heatCellKind({ ...base, paid: 1000, rest: 0 }, '2026-09-27'), 'paid');
  assert.equal(heatCellKind({ ...base, paid: 300, rest: 700 }, '2026-09-27'), 'partial');
  assert.equal(heatCellKind({ ...base, paid: 0, rest: 1000 }, '2026-09-27'), 'unpaid');
  assert.equal(heatCellKind({ ...base, paid: 0, rest: 1000 }, '2026-09-03'), 'upcoming');
  assert.equal(heatCellKind({ ...base, expected: 0, paid: 0, rest: 0 }, '2026-09-27'), 'none');
  assert.equal(heatCellKind({ ...base, expected: null, paid: null, rest: null }, '2026-09-27'), 'none');
});

test('summarizeSchoolYear: sold = restanțele scadente, celule pe luni, rata de încasare până azi', () => {
  const records = /** @type {any} */ ({
    children: [
      child({
        attendanceDate: '2026-10-01',
        contractDate: '2026-10-01',
        feeHistory: [{ from: '2026-10', amount: 1000 }],
      }),
    ],
    payments: [payment({ date: '2026-10-03', allocations: [{ month: '2026-10', amount: 400 }] })],
  });
  const year = evaluateChildrenForSchoolYear(records, 2026, '2026-12-15');
  const summary = summarizeSchoolYear(year, '2026-12-15', '2026-12');
  const [row] = summary.rows;
  assert.equal(row.hasObligation, true);
  assert.equal(row.cells[0].kind, 'none'); // 2026-09, înainte de contract
  assert.equal(row.cells[1].kind, 'partial'); // 2026-10
  assert.equal(row.cells[2].kind, 'unpaid'); // 2026-11
  assert.equal(row.cells[3].kind, 'unpaid'); // 2026-12, scadent pe 1, asOf 15
  assert.equal(row.cells[4].kind, 'upcoming'); // 2027-01
  assert.deepEqual(row.sold, { amount: 2600, currency: 'MDL' });
  assert.equal(summary.overdueChildren, 1);
  assert.equal(summary.unrecovered, 2600);
  assert.equal(summary.collectionRate, 400 / 3000);
  assert.equal(summary.partialThisMonth, 0);
});

test('summarizeSchoolYear: un copil complet în afara anului nu are obligație, rata e null fără scadențe', () => {
  const records = /** @type {any} */ ({
    children: [
      child({
        attendanceDate: '2027-09-01',
        contractDate: '2027-09-01',
        feeHistory: [{ from: '2027-09', amount: 1000 }],
      }),
    ],
    payments: [],
  });
  const summary = summarizeSchoolYear(
    evaluateChildrenForSchoolYear(records, 2026, '2026-09-27'),
    '2026-09-27',
    '2026-09',
  );
  assert.equal(summary.rows[0].hasObligation, false);
  assert.equal(summary.collectionRate, null);
});

test('summarizeSchoolYear: soldul rămâne în moneda copilului când toate lunile scadente sunt în EUR', () => {
  const records = /** @type {any} */ ({
    children: [child({ feeHistory: [{ from: '2026-01', amount: 100, currency: 'EUR' }] })],
    payments: [],
  });
  const summary = summarizeSchoolYear(
    evaluateChildrenForSchoolYear(records, 2026, '2026-10-27'),
    '2026-10-27',
    '2026-10',
    {
      '2026-10-01': 20,
    },
  );
  assert.deepEqual(summary.rows[0].sold, { amount: 200, currency: 'EUR' });
  assert.equal(summary.unrecovered, 4000);
});
