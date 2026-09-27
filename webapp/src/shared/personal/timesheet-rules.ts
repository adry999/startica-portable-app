import { monthDates } from '#shared/domain/calendar-month.mjs';
import { isWorkingDay } from '#shared/domain/holidays-md.mjs';
import type { Staff, TimesheetCode, TimesheetMonthSummary, TimesheetRow } from './personal.types';

/**
 * Portul webapp al `src/features/personal/domain/timesheet-month.mjs` și al ciclului de clic din
 * `personal-schema.mjs` — vezi nota din `personal.types.ts`. Comportamentul trebuie să rămână identic.
 */

export const timesheetKey = (staffId: string, date: string): string => `${staffId}|${date}`;

const CLICK_CYCLE: (TimesheetCode | '')[] = ['', 'CO', 'CM', 'A'];

/** Ciclul din 23b: clic pe celulă merge gol → CO → CM → A → gol. */
export function nextTimesheetCode(code: TimesheetCode | '' | null): TimesheetCode | null {
  const normalized = code || '';
  const index = CLICK_CYCLE.indexOf(normalized);
  const nextIndex = index === -1 ? 0 : (index + 1) % CLICK_CYCLE.length;
  return (CLICK_CYCLE[nextIndex] || null) as TimesheetCode | null;
}

export function isStaffInBranch(staff: Pick<Staff, 'branchIds'>, branchId: string): boolean {
  return staff.branchIds.includes(branchId);
}

/** „ambele filiale” — angajatul lucrează la toate filialele existente (cel puțin două). */
export function worksAtAllBranches(staff: Pick<Staff, 'branchIds'>, branchIds: string[]): boolean {
  return branchIds.length > 1 && branchIds.every(branchId => staff.branchIds.includes(branchId));
}

/** Zilele lucrătoare ale lunii în care angajatul era activ (între „since” și „archivedAt”). */
export function workingDatesFor(staff: Pick<Staff, 'since' | 'archivedAt'>, month: string): string[] {
  return monthDates(month).filter(
    date => isWorkingDay(date) && date >= staff.since && (!staff.archivedAt || date <= staff.archivedAt),
  );
}

/**
 * Lipsa rândului într-o zi lucrătoare numărată = lucrat 8 ore (decizia 12).
 * `upTo: 'today'` se oprește la ziua curentă (contoarele ecranului 23b); `upTo: 'month'`
 * ia toată luna (tipărire 23k și calculul salariului).
 */
export function summarizeTimesheetMonth({
  staff,
  month,
  rows,
  todayStr,
  upTo,
}: {
  staff: Pick<Staff, 'id' | 'since' | 'archivedAt'>;
  month: string;
  rows: ReadonlyMap<string, TimesheetRow>;
  todayStr: string;
  upTo: 'today' | 'month';
}): TimesheetMonthSummary {
  const cells = monthDates(month).map(date => {
    if (date < staff.since || (staff.archivedAt && date > staff.archivedAt))
      return { date, kind: 'none' as const };
    if (!isWorkingDay(date)) return { date, kind: 'off' as const };
    if (upTo === 'today' && date > todayStr) return { date, kind: 'future' as const };
    const row = rows.get(timesheetKey(staff.id, date));
    return { date, kind: (row ? row.code : '') as TimesheetMonthSummary['cells'][number]['kind'] };
  });

  const counted = cells.filter(cell => cell.kind !== 'off' && cell.kind !== 'none' && cell.kind !== 'future');
  const countOf = (code: TimesheetCode | '') => counted.filter(cell => cell.kind === code).length;

  return {
    staffId: staff.id,
    cells,
    worked: countOf(''),
    hours: countOf('') * 8,
    co: countOf('CO'),
    cm: countOf('CM'),
    a: countOf('A'),
    i: countOf('I'),
    fp: countOf('FP'),
    workingDays: counted.length,
  };
}
