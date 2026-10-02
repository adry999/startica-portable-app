import { shiftDays } from '#shared/domain/calendar-month.mjs';
import { isWorkingDay } from '#shared/domain/holidays-md.mjs';

/** @typedef {import('../personal.types.d.mts').TimesheetCode} TimesheetCode */

/** Luni (ISO) a săptămânii care conține `date` — folosit ca ancoră pentru WeekFillBar (§9.2/41b). */
export function weekStartOf(date) {
  const day = new Date(date + 'T12:00:00Z').getUTCDay(); // 0=duminică…6=sâmbătă
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return shiftDays(date, diffToMonday);
}

/** Datele de luni până vineri ale săptămânii care începe la `weekStart`. */
export function weekdaysOf(weekStart) {
  return Array.from({ length: 5 }, (_, index) => shiftDays(weekStart, index));
}

/**
 * „Toți prezenți L–V” / „Prezent toată săptămâna” (41b): zilele lucrătoare goale ale
 * săptămânii primesc codul 'P' — sare peste weekend/sărbători (nu sunt zile lucrătoare) și
 * peste orice zi deja marcată (concediu scris direct în pontaj, absență, o completare anterioară).
 * @param {{ staffIds: string[], weekStart: string, hasRow: (staffId: string, date: string) => boolean }} input
 * @returns {{ staffId: string, date: string, code: 'P' }[]}
 */
export function computePresentWeekFill({ staffIds, weekStart, hasRow }) {
  /** @type {{ staffId: string, date: string, code: 'P' }[]} */
  const changes = [];
  for (const staffId of staffIds)
    for (const date of weekdaysOf(weekStart))
      if (isWorkingDay(date) && !hasRow(staffId, date)) changes.push({ staffId, date, code: 'P' });
  return changes;
}

/**
 * „Copiază săpt. trecută” (41b): copiază codul din aceeași zi a săptămânii anterioare
 * (luni→luni, marți→marți…) în celula goală a săptămânii curente. O zi fără rând în
 * săptămâna trecută (lucrat) nu are ce copia — rămâne goală, ca și până acum.
 * @param {{
 *   staffIds: string[],
 *   weekStart: string,
 *   hasRow: (staffId: string, date: string) => boolean,
 *   readCode: (staffId: string, date: string) => TimesheetCode | null,
 * }} input
 * @returns {{ staffId: string, date: string, code: TimesheetCode }[]}
 */
export function computeCopyPreviousWeekFill({ staffIds, weekStart, hasRow, readCode }) {
  const previousWeekStart = shiftDays(weekStart, -7);
  const targetDates = weekdaysOf(weekStart);
  const sourceDates = weekdaysOf(previousWeekStart);
  /** @type {{ staffId: string, date: string, code: TimesheetCode }[]} */
  const changes = [];
  for (const staffId of staffIds)
    for (let index = 0; index < targetDates.length; index += 1) {
      const targetDate = targetDates[index];
      if (!isWorkingDay(targetDate) || hasRow(staffId, targetDate)) continue;
      const code = readCode(staffId, sourceDates[index]);
      if (code) changes.push({ staffId, date: targetDate, code });
    }
  return changes;
}
