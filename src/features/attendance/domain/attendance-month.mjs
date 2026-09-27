import { isWorkingDay } from '#shared/domain/holidays-md.mjs';
import { attendanceKey, isChildEnrolledOn } from './attendance-rules.mjs';

/** @typedef {import('../attendance.types.d.mts').AttendanceEntry} AttendanceEntry */
/** @typedef {import('../attendance.types.d.mts').DayCellKind} DayCellKind */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */

/**
 * @param {string} month format YYYY-MM
 * @returns {string[]}
 */
export function monthDates(month) {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, day) => {
    const date = String(day + 1).padStart(2, '0');
    return `${month}-${date}`;
  });
}

/**
 * @param {string} date
 * @param {string} todayStr
 * @param {boolean} enrolled
 * @param {AttendanceEntry | undefined} entry
 * @returns {DayCellKind}
 */
function cellKindOf(date, todayStr, enrolled, entry) {
  if (!enrolled) return 'none';
  if (!isWorkingDay(date)) return 'off';
  if (date > todayStr) return 'future';
  return entry?.status ?? 'unmarked';
}

/**
 * @param {{
 *   children: Pick<Child, 'id' | 'archived' | 'attendanceDate' | 'contractDate' | 'withdrawalDate'>[],
 *   month: string,
 *   entries: ReadonlyMap<string, AttendanceEntry>,
 *   todayStr: string,
 * }} input
 */
export function summarizeMonth({ children, month, entries, todayStr }) {
  const dates = monthDates(month);
  const workingDays = dates.filter(date => isWorkingDay(date) && date <= todayStr);

  const rows = children.map(child => {
    const cells = dates.map(date => {
      const enrolled = isChildEnrolledOn(child, date);
      const entry = entries.get(attendanceKey(child.id, date));
      return { date, kind: cellKindOf(date, todayStr, enrolled, entry), reason: entry?.reason ?? '' };
    });
    const presentDays = cells.filter(cell => cell.kind === 'present').length;
    const rowWorkingDays = cells.filter(
      cell => cell.kind === 'present' || cell.kind === 'absent' || cell.kind === 'excused' || cell.kind === 'unmarked',
    ).length;
    return { childId: child.id, cells, presentDays, workingDays: rowWorkingDays };
  });

  const presentPerDay = dates.map((date, index) => {
    if (!isWorkingDay(date) || date > todayStr) return null;
    return rows.reduce((count, row) => count + (row.cells[index].kind === 'present' ? 1 : 0), 0);
  });

  return { dates, rows, presentPerDay, workingDays: workingDays.length };
}
