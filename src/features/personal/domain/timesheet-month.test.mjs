import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTimesheetMonth, workingDatesFor, timesheetKey } from './timesheet-month.mjs';

const staff = { id: 'STF-1', since: '2026-09-01', archivedAt: null };

test('lipsa rândului într-o zi lucrătoare înseamnă 8 ore lucrate; weekendul și sărbătorile nu contează', () => {
  // 2026-09: 30 zile, weekend-uri 5,6,12,13,19,20,26,27; nicio sărbătoare legală MD în septembrie.
  const summary = summarizeTimesheetMonth({
    staff,
    month: '2026-09',
    rows: new Map(),
    todayStr: '2026-09-30',
    upTo: 'month',
  });
  assert.equal(summary.workingDays, 22);
  assert.equal(summary.worked, 22);
  assert.equal(summary.hours, 176);
  const weekend = summary.cells.find(cell => cell.date === '2026-09-05');
  assert.equal(weekend?.kind, 'off');
});

test('contoarele ecranului se opresc azi, cele de tipar și salariu iau toată luna', () => {
  /** @type {Map<string, Pick<import('../personal.types.d.mts').TimesheetRow, 'code'>>} */
  const rows = new Map([[timesheetKey('STF-1', '2026-09-08'), { code: 'CO' }]]);
  const screen = summarizeTimesheetMonth({ staff, month: '2026-09', rows, todayStr: '2026-09-10', upTo: 'today' });
  const printOrSalary = summarizeTimesheetMonth({
    staff,
    month: '2026-09',
    rows,
    todayStr: '2026-09-10',
    upTo: 'month',
  });

  assert.ok(screen.workingDays < printOrSalary.workingDays);
  const futureCell = screen.cells.find(cell => cell.date === '2026-09-15');
  assert.equal(futureCell?.kind, 'future');
  const sameCellInMonth = printOrSalary.cells.find(cell => cell.date === '2026-09-15');
  assert.equal(sameCellInMonth?.kind, '');
  assert.equal(screen.co, 1);
  assert.equal(printOrSalary.co, 1);
});

test('workingDatesFor exclude zilele dinaintea angajării și de după arhivare', () => {
  const midMonthStaff = { since: '2026-09-10', archivedAt: '2026-09-20' };
  const dates = workingDatesFor(midMonthStaff, '2026-09');
  assert.ok(dates.every(date => date >= '2026-09-10' && date <= '2026-09-20'));
  assert.ok(dates.includes('2026-09-10'));
  assert.ok(!dates.includes('2026-09-21'));
});
