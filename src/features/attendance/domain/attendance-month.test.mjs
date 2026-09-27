import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceKey } from './attendance-rules.mjs';
import { monthDates, summarizeMonth } from './attendance-month.mjs';

/** @typedef {import('../attendance.types.d.mts').AttendanceEntry} AttendanceEntry */

/** @returns {[string, AttendanceEntry]} */
const entry = (childId, date, status, reason = '') => [
  attendanceKey(childId, date),
  { childId, date, status, reason, updatedAt: '' },
];

test('monthDates întoarce toate zilele lunii, în ordine', () => {
  assert.deepEqual(monthDates('2026-09').slice(0, 3), ['2026-09-01', '2026-09-02', '2026-09-03']);
  assert.equal(monthDates('2026-09').length, 30);
});

test('weekend-urile și sărbătorile sunt off, zilele de după azi sunt future, zilele dinaintea înscrierii sunt none', () => {
  const enrolledEarly = { id: 'A', attendanceDate: '2026-09-01' };
  const enrolledLate = { id: 'B', attendanceDate: '2026-09-15' };
  const { rows } = summarizeMonth({
    children: [enrolledEarly, enrolledLate],
    month: '2026-09',
    entries: new Map(),
    todayStr: '2026-09-10',
  });
  const rowA = rows.find(row => row.childId === 'A');
  const rowB = rows.find(row => row.childId === 'B');
  assert.ok(rowA);
  assert.ok(rowB);
  assert.equal(rowA.cells.find(cell => cell.date === '2026-09-05')?.kind, 'off');
  assert.equal(rowA.cells.find(cell => cell.date === '2026-09-11')?.kind, 'future');
  assert.equal(rowA.cells.find(cell => cell.date === '2026-09-08')?.kind, 'unmarked');
  assert.equal(rowB.cells.find(cell => cell.date === '2026-09-08')?.kind, 'none');
});

test('celula unei zile motivate poartă motivul salvat, altfel gol', () => {
  const child = { id: 'C', attendanceDate: '2026-09-01' };
  const entries = new Map([entry('C', '2026-09-02', 'excused', 'Boală'), entry('C', '2026-09-03', 'absent')]);
  const { rows } = summarizeMonth({ children: [child], month: '2026-09', entries, todayStr: '2026-09-10' });
  const row = rows[0];
  assert.equal(row.cells.find(cell => cell.date === '2026-09-02')?.reason, 'Boală');
  assert.equal(row.cells.find(cell => cell.date === '2026-09-03')?.reason, '');
  assert.equal(row.cells.find(cell => cell.date === '2026-09-08')?.reason, '', 'nemarcat: fără motiv');
});

test('Zile = prezențe / zile lucrătoare până azi, per copil', () => {
  const child = { id: 'C', attendanceDate: '2026-09-01' };
  const entries = new Map([
    entry('C', '2026-09-01', 'present'),
    entry('C', '2026-09-02', 'present'),
    entry('C', '2026-09-03', 'present'),
    entry('C', '2026-09-04', 'absent'),
  ]);
  const { rows, workingDays } = summarizeMonth({
    children: [child],
    month: '2026-09',
    entries,
    todayStr: '2026-09-10',
  });
  const row = rows[0];
  // Zile lucrătoare 1-10 septembrie, fără weekend-ul 5-6: 1,2,3,4,7,8,9,10.
  assert.equal(row.workingDays, 8);
  assert.equal(row.presentDays, 3);
  assert.equal(workingDays, 8);
});

test('rândul de jos numără prezenții pe zi și e null în zilele off', () => {
  const childOne = { id: 'C1', attendanceDate: '2026-09-01' };
  const childTwo = { id: 'C2', attendanceDate: '2026-09-01' };
  const entries = new Map([
    entry('C1', '2026-09-01', 'present'),
    entry('C2', '2026-09-01', 'present'),
    entry('C2', '2026-09-02', 'absent'),
  ]);
  const { dates, presentPerDay } = summarizeMonth({
    children: [childOne, childTwo],
    month: '2026-09',
    entries,
    todayStr: '2026-09-10',
  });
  assert.equal(presentPerDay[dates.indexOf('2026-09-01')], 2);
  assert.equal(presentPerDay[dates.indexOf('2026-09-02')], 0);
  assert.equal(presentPerDay[dates.indexOf('2026-09-05')], null, 'sâmbătă e off');
  assert.equal(presentPerDay[dates.indexOf('2026-09-11')], null, 'zi viitoare');
});
