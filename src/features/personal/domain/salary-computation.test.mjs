import test from 'node:test';
import assert from 'node:assert/strict';
import { salaryForMonth, salaryEntryFor } from './salary-computation.mjs';

const row = (overrides = {}) => ({
  a: 0,
  i: 0,
  fp: 0,
  worked: 20,
  workingDays: 22,
  workingDaysInMonth: 22,
  ...overrides,
});

test('salariul fix scade doar pentru A când deductOnlyUnexcused e activ, și pentru A/I/FP altfel; concediul și boala nu scad', () => {
  const timesheetRow = row({ a: 1, i: 1, fp: 1, worked: 19, workingDays: 22 });
  const onlyUnexcused = salaryForMonth({
    salary: { mode: 'fix', amount: 4400 },
    timesheetRow,
    settings: { deductOnlyUnexcused: true },
    coachPay: null,
  });
  assert.equal(onlyUnexcused.deductible, 1);
  assert.equal(onlyUnexcused.gross, Math.round((4400 - (4400 * 1) / 22) * 100) / 100);
  assert.match(onlyUnexcused.base, /1 zile absent/);

  const all = salaryForMonth({
    salary: { mode: 'fix', amount: 4400 },
    timesheetRow,
    settings: { deductOnlyUnexcused: false },
    coachPay: null,
  });
  assert.equal(all.deductible, 3);

  // concediul (CO/CM) nu apare deloc în deducerea salariului fix — nu are câmp propriu în row.
  const noAbsence = salaryForMonth({
    salary: { mode: 'fix', amount: 4400 },
    timesheetRow: row(),
    settings: { deductOnlyUnexcused: true },
    coachPay: null,
  });
  assert.equal(noAbsence.gross, 4400);
  assert.equal(noAbsence.base, '4400 lei / lună');
});

test('salariul fix e pro-rata pentru un angajat intrat în cursul lunii (M3)', () => {
  // Angajat de la 15: 12 zile lucrătoare active din 22 ale lunii, 2 zile absente nemotivat.
  const timesheetRow = row({ a: 2, worked: 10, workingDays: 12, workingDaysInMonth: 22 });
  const result = salaryForMonth({
    salary: { mode: 'fix', amount: 4400 },
    timesheetRow,
    settings: { deductOnlyUnexcused: true },
    coachPay: null,
  });
  assert.equal(result.gross, Math.round(((4400 * (12 - 2)) / 22) * 100) / 100);
  assert.match(result.base, /12 din 22 zile lucrătoare/);
  assert.match(result.base, /2 zile absent/);
});

test('salariul pe zile = tarif × zilele lucrate din toată luna', () => {
  const result = salaryForMonth({
    salary: { mode: 'zi', amount: 250 },
    timesheetRow: row({ worked: 18 }),
    settings: { deductOnlyUnexcused: true },
    coachPay: null,
  });
  assert.equal(result.gross, 4500);
  assert.equal(result.base, '250 lei × 18 zile');
});

test('salariul de tip bazin ignoră amount și vine din coachPay, sau arată „de închis în Bazin”', () => {
  const notClosed = salaryForMonth({
    salary: { mode: 'bazin', amount: 999 },
    timesheetRow: row(),
    settings: { deductOnlyUnexcused: true },
    coachPay: null,
  });
  assert.equal(notClosed.gross, null);
  assert.equal(notClosed.base, 'de închis în Bazin');

  const closed = salaryForMonth({
    salary: { mode: 'bazin', amount: 999 },
    timesheetRow: row(),
    settings: { deductOnlyUnexcused: true },
    coachPay: { amount: 480, rate: 60, sessionsHeld: 8, childrenPresent: 8, mode: 'per_child' },
  });
  assert.equal(closed.gross, 480);
  assert.equal(closed.base, '60 lei × 8 copii');
});

test('salaryEntryFor ia ultima intrare cu validFrom <= lună', () => {
  /** @type {import('./salary-computation.mjs').Salary[]} */
  const salaries = [
    { id: 'SAL-1', staffId: 'STF-1', mode: 'fix', amount: 4000, validFrom: '2026-01' },
    { id: 'SAL-2', staffId: 'STF-1', mode: 'fix', amount: 4400, validFrom: '2026-06' },
  ];
  assert.equal(salaryEntryFor(salaries, 'STF-1', '2026-05')?.amount, 4000);
  assert.equal(salaryEntryFor(salaries, 'STF-1', '2026-06')?.amount, 4400);
  assert.equal(salaryEntryFor(salaries, 'STF-1', '2025-12'), null);
});
