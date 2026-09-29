import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord } from '#shared/domain/record-schema.mjs';
import { reportPeriodBounds, buildAccountingReport } from './accounting-report.mjs';

const payment = overrides => {
  const amount = overrides?.amount ?? 1000;
  return normalizeRecord('payments', {
    id: `PAY-${Math.random().toString(36).slice(2)}`,
    childId: 'C-1',
    date: '2026-08-05',
    amount,
    method: 'Cash',
    allocations: [{ month: '2026-08', amount }],
    ...overrides,
  });
};

const expense = overrides =>
  normalizeRecord('expenses', {
    id: `EXP-${Math.random().toString(36).slice(2)}`,
    date: '2026-08-05',
    category: 'Alimentație',
    description: 'Piață',
    amount: 500,
    ...overrides,
  });

const child = overrides =>
  normalizeRecord('children', { id: 'C-1', name: 'Copil Test', status: 'Activ', ...overrides });

function records(overrides = {}) {
  return { children: [child()], payments: [], expenses: [], groups: [], categories: [], visits: [], ...overrides };
}

test('reportPeriodBounds: luna acoperă exact zilele lunii, inclusiv februarie', () => {
  assert.deepEqual(reportPeriodBounds('month', '2026-02'), {
    from: '2026-02-01',
    to: '2026-02-28',
    label: 'Februarie 2026',
  });
});

test('reportPeriodBounds: trimestrul acoperă cele 3 luni ale lui, cu eticheta cifrei romane', () => {
  assert.deepEqual(reportPeriodBounds('quarter', '2026-08'), {
    from: '2026-07-01',
    to: '2026-09-30',
    label: 'Trimestrul III 2026',
  });
});

test('reportPeriodBounds: anul acoperă 1 ianuarie – 31 decembrie', () => {
  assert.deepEqual(reportPeriodBounds('year', '2026-08'), { from: '2026-01-01', to: '2026-12-31', label: 'Anul 2026' });
});

test('buildAccountingReport: totalurile de pe ecran sunt suma rândurilor din Excel (paymentRows/expenseRows)', () => {
  const period = reportPeriodBounds('month', '2026-08');
  const data = records({
    payments: [
      payment({ id: 'PAY-1', amount: 1000, method: 'Cash' }),
      payment({ id: 'PAY-2', amount: 500, method: 'Card', date: '2026-08-10' }),
      payment({ id: 'PAY-3', amount: 200, date: '2026-09-01' }), // afară din perioadă
      payment({ id: 'PAY-4', amount: 300, archived: true }), // arhivată, exclusă
    ],
    expenses: [
      expense({ id: 'EXP-1', amount: 400, category: 'Salarii' }),
      expense({ id: 'EXP-2', amount: 100, date: '2026-09-01' }), // afară din perioadă
    ],
  });

  const report = buildAccountingReport(data, period);

  assert.equal(
    report.income,
    report.paymentRows.reduce((sum, row) => sum + row.amount, 0),
  );
  assert.equal(
    report.expense,
    report.expenseRows.reduce((sum, row) => sum + row.amount, 0),
  );
  assert.equal(report.income, 1500);
  assert.equal(report.incomeCount, 2);
  assert.equal(report.expense, 400);
  assert.equal(report.expenseCount, 1);
  assert.equal(report.balance, 1100);
});

test('buildAccountingReport: achitările neasociate (fără copil) intră în raport și în contorul de neasociate', () => {
  const period = reportPeriodBounds('month', '2026-08');
  const data = records({ payments: [payment({ id: 'PAY-1', childId: '', sourceName: 'Ion Popescu' })] });

  const report = buildAccountingReport(data, period);

  assert.equal(report.income, 1000);
  assert.equal(report.unassignedCount, 1);
  assert.equal(report.paymentRows[0].payerLabel, 'Ion Popescu');
});

test('buildAccountingReport: fiecare rând de achitare are numele serviciului (B3) — implicit Grădiniță', () => {
  const period = reportPeriodBounds('month', '2026-08');
  const data = records({
    payments: [payment({ id: 'PAY-1' }), payment({ id: 'PAY-2', service: 'bazin' })],
  });

  const report = buildAccountingReport(data, period);

  assert.equal(report.paymentRows.find(row => row.id === 'PAY-1')?.service, 'Grădiniță');
  assert.equal(report.paymentRows.find(row => row.id === 'PAY-2')?.service, 'Bazin');
});

test('buildAccountingReport: repartizarea pe metodă adună tenders, nu achitări (o achitare cu 2 metode contează la ambele)', () => {
  const period = reportPeriodBounds('month', '2026-08');
  const data = records({
    payments: [
      payment({
        id: 'PAY-1',
        amount: 1500,
        tenders: [
          { method: 'Cash', amount: 1000 },
          { method: 'Card', amount: 500 },
        ],
      }),
    ],
  });

  const report = buildAccountingReport(data, period);
  const cash = report.byMethod.find(entry => entry.method === 'Cash') ?? assert.fail('lipsește Cash');
  const card = report.byMethod.find(entry => entry.method === 'Card') ?? assert.fail('lipsește Card');

  assert.equal(cash.amount, 1000);
  assert.equal(card.amount, 500);
  assert.equal(Math.round(cash.percent), 67);
});

test('buildAccountingReport: cheltuielile se grupează pe cele 5 categorii uzuale, indiferent de diacritice', () => {
  const period = reportPeriodBounds('month', '2026-08');
  const data = records({
    expenses: [
      expense({ id: 'EXP-1', category: 'salarii educatoare', amount: 600 }),
      expense({ id: 'EXP-2', category: 'Chirie', amount: 100 }),
    ],
  });

  const report = buildAccountingReport(data, period);

  assert.equal(report.byCategory.find(entry => entry.category === 'Salarii')?.amount, 600);
  assert.equal(report.byCategory.find(entry => entry.category === 'Altele')?.amount, 100);
});

test('buildAccountingReport: cheltuielile mutate la „General” (categorie ștearsă) cad la bucket-ul „Altele”', () => {
  const period = reportPeriodBounds('month', '2026-08');
  const data = records({ expenses: [expense({ id: 'EXP-1', category: 'General', amount: 100 })] });

  const report = buildAccountingReport(data, period);

  assert.equal(report.byCategory.find(entry => entry.category === 'Altele')?.amount, 100);
});

test('buildAccountingReport: lista EUR ține doar achitările cu fxRate salvat, cu suma EUR neschimbată de cursul de azi', () => {
  const period = reportPeriodBounds('month', '2026-08');
  const data = records({
    payments: [
      payment({ id: 'PAY-1', amount: 1000, fxRate: 19.74, fxRateSource: 'bnm', amountEur: 50.66 }),
      payment({ id: 'PAY-2', amount: 500 }), // fără fxRate — nu apare în lista EUR
    ],
  });

  const report = buildAccountingReport(data, period);

  assert.equal(report.eurRows.length, 1);
  assert.equal(report.eurRows[0].amountEur, 50.66);
  assert.equal(report.eurRows[0].fxRateSource, 'bnm');
  assert.equal(report.eurTotalEur, 50.66);
});

test('buildAccountingReport: tabelul pe zile ține doar zilele cu mișcări, cu Cash separat de Card+Transfer', () => {
  const period = reportPeriodBounds('month', '2026-08');
  const data = records({
    payments: [
      payment({ id: 'PAY-1', date: '2026-08-03', amount: 1000, method: 'Cash' }),
      payment({ id: 'PAY-2', date: '2026-08-03', amount: 200, method: 'Transfer' }),
    ],
    expenses: [expense({ id: 'EXP-1', date: '2026-08-10', amount: 300 })],
  });

  const report = buildAccountingReport(data, period);

  assert.equal(report.days.length, 2);
  const [day3, day10] = report.days;
  assert.equal(day3.date, '2026-08-03');
  assert.equal(day3.cash, 1000);
  assert.equal(day3.cardTransfer, 200);
  assert.equal(day3.balance, 1200);
  assert.equal(day10.expense, 300);
  assert.equal(day10.balance, -300);
});

test('buildAccountingReport: achitările arhivate nu intră în niciun agregat', () => {
  const period = reportPeriodBounds('month', '2026-08');
  const data = records({
    payments: [payment({ id: 'PAY-1', archived: true, archivedAt: '2026-08-06T00:00:00.000Z' })],
  });

  const report = buildAccountingReport(data, period);

  assert.equal(report.income, 0);
  assert.equal(report.paymentRows.length, 0);
  assert.equal(report.days.length, 0);
});

test('buildAccountingReport: cu options.includeArchived, exportul (nu ecranul) poate include și achitările arhivate', () => {
  const period = reportPeriodBounds('month', '2026-08');
  const data = records({
    payments: [payment({ id: 'PAY-1', amount: 700, archived: true, archivedAt: '2026-08-06T00:00:00.000Z' })],
  });

  assert.equal(buildAccountingReport(data, period).income, 0);
  assert.equal(buildAccountingReport(data, period, { includeArchived: true }).income, 700);
});
