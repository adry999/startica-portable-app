import { describe, expect, it } from 'vitest';
import { nextTimesheetCode, summarizeTimesheetMonth, worksAtAllBranches } from './timesheet-rules';
import type { TimesheetRow } from './personal.types';

describe('nextTimesheetCode', () => {
  it('ciclează gol → CO → CM → A → gol', () => {
    expect(nextTimesheetCode(null)).toBe('CO');
    expect(nextTimesheetCode('CO')).toBe('CM');
    expect(nextTimesheetCode('CM')).toBe('A');
    expect(nextTimesheetCode('A')).toBe(null);
  });

  it('un cod din afara ciclului (I, FP) se golește la următorul clic', () => {
    expect(nextTimesheetCode('FP')).toBe(null);
  });

  it('zilele viitoare acceptă doar gol → CO → CM → gol, fără A', () => {
    expect(nextTimesheetCode(null, { future: true })).toBe('CO');
    expect(nextTimesheetCode('CO', { future: true })).toBe('CM');
    expect(nextTimesheetCode('CM', { future: true })).toBe(null);
  });
});

describe('summarizeTimesheetMonth', () => {
  const staff = { id: 'STF-1', since: '2020-01-01', archivedAt: null };

  it('lipsa rândului într-o zi lucrătoare înseamnă 8 ore lucrate; weekendul și sărbătorile nu contează', () => {
    const rows = new Map<string, TimesheetRow>();
    const summary = summarizeTimesheetMonth({ staff, month: '2020-02', rows, todayStr: '2020-02-29', upTo: 'month' });
    // Februarie 2020: 29 zile, fără sărbători legale RM cunoscute în februarie.
    expect(summary.workingDays).toBeGreaterThan(0);
    expect(summary.worked).toBe(summary.workingDays);
    expect(summary.hours).toBe(summary.worked * 8);
  });

  it('contoarele ecranului se opresc azi, cele de tipar și salariu iau toată luna', () => {
    const rows = new Map<string, TimesheetRow>();
    const todayCount = summarizeTimesheetMonth({
      staff,
      month: '2020-02',
      rows,
      todayStr: '2020-02-10',
      upTo: 'today',
    }).workingDays;
    const monthCount = summarizeTimesheetMonth({
      staff,
      month: '2020-02',
      rows,
      todayStr: '2020-02-10',
      upTo: 'month',
    }).workingDays;
    expect(todayCount).toBeLessThan(monthCount);
  });

  it('un cod CO scris în pontaj e numărat separat de zilele lucrate', () => {
    const rows = new Map<string, TimesheetRow>([
      ['STF-1|2020-02-03', { id: 'TS-1', staffId: 'STF-1', date: '2020-02-03', code: 'CO' }],
    ]);
    const summary = summarizeTimesheetMonth({ staff, month: '2020-02', rows, todayStr: '2020-02-29', upTo: 'month' });
    expect(summary.co).toBe(1);
    expect(summary.worked).toBe(summary.workingDays - 1);
  });

  it('o zi viitoare marcată (concediu planificat) își arată codul, nu „future”, și e numărată', () => {
    const rows = new Map<string, TimesheetRow>([
      ['STF-1|2020-02-20', { id: 'TS-1', staffId: 'STF-1', date: '2020-02-20', code: 'CO' }],
    ]);
    const summary = summarizeTimesheetMonth({ staff, month: '2020-02', rows, todayStr: '2020-02-10', upTo: 'today' });
    const marked = summary.cells.find(cell => cell.date === '2020-02-20');
    expect(marked?.kind).toBe('CO');
    expect(summary.co).toBe(1);

    // O zi viitoare fără cod rămâne „future” (pastilă punctată, fără a fi numărată).
    const unmarked = summary.cells.find(cell => cell.date === '2020-02-21');
    expect(unmarked?.kind).toBe('future');
  });
});

describe('worksAtAllBranches', () => {
  it('un angajat cu toate filialele existente lucrează „la ambele”', () => {
    expect(worksAtAllBranches({ branchIds: ['bu', 'bo'] }, ['bu', 'bo'])).toBe(true);
    expect(worksAtAllBranches({ branchIds: ['bu'] }, ['bu', 'bo'])).toBe(false);
    expect(worksAtAllBranches({ branchIds: ['bu'] }, ['bu'])).toBe(false);
  });
});
