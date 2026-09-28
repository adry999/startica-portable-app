import { monthDates } from '#shared/domain/calendar-month.mjs';
import { isWorkingDay } from '#shared/domain/holidays-md.mjs';

/** @typedef {import('../personal.types.d.mts').Staff} Staff */
/** @typedef {import('../personal.types.d.mts').TimesheetRow} TimesheetRow */
/** @typedef {import('../personal.types.d.mts').TimesheetMonthSummary} TimesheetMonthSummary */
/** @typedef {import('../personal.types.d.mts').TimesheetCell} TimesheetCell */

/** @param {string} date @param {TimesheetCell['kind']} kind @returns {TimesheetCell} */
const cell = (date, kind) => ({ date, kind });

/** @param {string} staffId @param {string} date */
export const timesheetKey = (staffId, date) => `${staffId}|${date}`;

/**
 * Zilele lucrătoare ale lunii în care angajatul era activ (între „since” și „archivedAt”).
 * @param {Pick<Staff, 'since' | 'archivedAt'>} staff
 * @param {string} month
 * @returns {string[]}
 */
export function workingDatesFor(staff, month) {
  return monthDates(month).filter(
    date => isWorkingDay(date) && date >= staff.since && (!staff.archivedAt || date <= staff.archivedAt),
  );
}

/**
 * Lipsa rândului într-o zi lucrătoare numărată = lucrat 8 ore (decizia 12 din plan).
 * `upTo: 'today'` se oprește la ziua curentă (contoarele ecranului 23b); `upTo: 'month'`
 * ia toată luna (tipărire 23k și calculul salariului — o lună închisă se calculează integral).
 * @param {{
 *   staff: Pick<Staff, 'id' | 'since' | 'archivedAt'>,
 *   month: string,
 *   rows: ReadonlyMap<string, Pick<TimesheetRow, 'code'>>,
 *   todayStr: string,
 *   upTo: 'today' | 'month',
 * }} input
 * @returns {TimesheetMonthSummary}
 */
export function summarizeTimesheetMonth({ staff, month, rows, todayStr, upTo }) {
  const monthDatesList = monthDates(month);
  // Zilele lucrătoare ale lunii calendaristice întregi (M3): baza de împărțire a salariului
  // fix pro-rata, independentă de intervalul activ al angajatului — un angajat intrat pe
  // 15 primește proporția din toată luna, nu din cele câteva zile în care a fost activ.
  const workingDaysInMonth = monthDatesList.filter(isWorkingDay).length;
  const cells = monthDatesList.map(date => {
    if (date < staff.since || (staff.archivedAt && date > staff.archivedAt)) return cell(date, 'none');
    if (!isWorkingDay(date)) return cell(date, 'off');
    if (upTo === 'today' && date > todayStr) return cell(date, 'future');
    const row = rows.get(timesheetKey(staff.id, date));
    return cell(date, row ? row.code : '');
  });

  const counted = cells.filter(cell => cell.kind !== 'off' && cell.kind !== 'none' && cell.kind !== 'future');
  const countOf = code => counted.filter(cell => cell.kind === code).length;

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
    workingDaysInMonth,
  };
}
