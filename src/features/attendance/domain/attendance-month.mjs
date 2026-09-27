import { isWorkingDay } from '#shared/domain/holidays-md.mjs';
import { monthDates } from '#shared/domain/calendar-month.mjs';
import { attendanceKey, isChildEnrolledOn } from './attendance-rules.mjs';

/** @typedef {import('../attendance.types.mjs').AttendanceEntry} AttendanceEntry */
/** @typedef {import('../attendance.types.mjs').DayCellKind} DayCellKind */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */

// Mutată în #shared/domain/calendar-month.mjs (Personal 24 o folosește și pentru pontaj);
// re-exportată aici ca importurile existente din attendance să nu se schimbe.
export { monthDates };

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
