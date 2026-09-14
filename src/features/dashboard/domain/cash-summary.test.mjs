import test from 'node:test';
import assert from 'node:assert/strict';
import { obligation } from '#shared/domain/tuition-obligation.mjs';
import { summarizeCashForMonth, sumUnallocatedAdvance } from './cash-summary.mjs';

/** @param {any} value */
const asAny = value => /** @type {any} */ (value);

test('summarizeCashForMonth totalizează încasările lunii pe metodă și scade cheltuielile', () => {
  const p = {
    id: 'P1',
    date: '2026-09-08',
    childId: 'C1',
    tenders: [
      { method: 'Cash', amount: 1000.1 },
      { method: 'Card', amount: 500.2 },
    ],
    amount: 1500.3,
    allocations: [{ month: '2026-09', amount: 1500.3 }],
  };
  const records = asAny({
    children: [],
    payments: [p],
    expenses: [{ id: 'E1', date: '2026-09-05', amount: 200, category: 'Altele', description: '' }],
    groups: [],
    categories: [],
  });
  const summary = summarizeCashForMonth(records, '2026-09');
  assert.equal(summary.income, 1500.3);
  assert.deepEqual(summary.byMethod, { Cash: 1000.1, Card: 500.2, Transfer: 0, Altele: 0 });
  assert.equal(summary.expense, 200);
  assert.equal(summary.net, 1300.3);
});

test('summarizeCashForMonth ignoră plățile arhivate sau din altă lună', () => {
  const records = asAny({
    children: [],
    payments: [{ id: 'P1', date: '2026-09-08', amount: 100, archived: true }],
    expenses: [],
    groups: [],
    categories: [],
  });
  assert.equal(summarizeCashForMonth(records, '2026-09').income, 0);
  assert.equal(
    summarizeCashForMonth(asAny({ ...records, payments: [{ id: 'P1', date: '2026-10-08', amount: 100 }] }), '2026-09')
      .income,
    0,
  );
});

test('summarizeCashForMonth pune metodele necunoscute la Altele', () => {
  const records = asAny({
    children: [],
    payments: [{ id: 'P1', date: '2026-09-08', amount: 300, tenders: [{ method: 'Bon', amount: 300 }] }],
    expenses: [],
    groups: [],
    categories: [],
  });
  assert.equal(summarizeCashForMonth(records, '2026-09').byMethod.Altele, 300);
});

test('sumUnallocatedAdvance ia partea nerepartizată dintr-o plată încasată la sau înainte de asOf', () => {
  const payments = asAny([
    { id: 'P1', date: '2026-09-05', amount: 500, allocations: [{ month: '2026-09', amount: 300 }] },
    { id: 'P2', date: '2026-09-05', amount: 200, allocations: [] },
  ]);
  assert.equal(sumUnallocatedAdvance(payments, '2026-09-08'), 400);
});

test('sumUnallocatedAdvance ignoră plățile arhivate sau ulterioare lui asOf', () => {
  const payments = asAny([
    { id: 'P1', date: '2026-09-05', amount: 500, allocations: [], archived: true },
    { id: 'P2', date: '2026-09-09', amount: 500, allocations: [] },
  ]);
  assert.equal(sumUnallocatedAdvance(payments, '2026-09-08'), 0);
});

test('Încasările lunii după data reală a plății', () => {
  const p = asAny({
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
  const s = asAny({ children: [], payments: [p], expenses: [], groups: [], categories: [] });
  assert.equal(summarizeCashForMonth(s, '2026-09').income, 3000);
  assert.equal(summarizeCashForMonth(s, '2026-10').income, 0);
});

test('Achitarea mixtă se împarte pe metode, cea arhivată nu contează', () => {
  const c = asAny({
    id: 'C1',
    status: 'Activ',
    attendanceDate: '2026-09-01',
    feeHistory: [{ from: '2026-09', amount: 1500 }],
    dueDay: 10,
  });
  const p = asAny({
    id: 'P1',
    childId: 'C1',
    date: '2026-09-08',
    tenders: [
      { method: 'Cash', amount: 1000.1 },
      { method: 'Card', amount: 500.2 },
    ],
    amount: 1500.3,
    allocations: [{ month: '2026-09', amount: 1500 }],
  });
  const s = asAny({ children: [c], payments: [p], expenses: [], groups: [], categories: [] });
  const summary = summarizeCashForMonth(s, '2026-09');
  assert.equal(summary.income, 1500.3);
  assert.deepEqual(summary.byMethod, { Cash: 1000.1, Card: 500.2, Transfer: 0, Altele: 0 });
  assert.equal(obligation(c, '2026-09', [p], '2026-09-08').paid, 1500);
  assert.equal(summarizeCashForMonth(asAny({ ...s, payments: [{ ...p, archived: true }] }), '2026-09').income, 0);
});
