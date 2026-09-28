import { monthDates, shiftDays } from '#shared/domain/calendar-month.mjs';
import { isWorkingDay } from '#shared/domain/holidays-md.mjs';

/** @param {string} date YYYY-MM-DD @returns {number} 1=luni…7=duminică */
export function weekdayOf(date) {
  const day = new Date(date + 'T12:00:00Z').getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Zilele lunii în care o programare are ședință: ziua săptămânii potrivită, în intervalul
 * [startDate, endDate], fără zilele legale nelucrătoare — o programare recurentă nu produce o
 * ședință fantomă de Anul Nou.
 * @param {import('../pool.types.d.mts').PoolBooking} booking
 * @param {string} month YYYY-MM
 * @returns {string[]}
 */
export function expandBooking(booking, month) {
  return monthDates(month).filter(date => {
    if (date < booking.startDate) return false;
    if (booking.endDate && date > booking.endDate) return false;
    if (weekdayOf(date) !== booking.weekday) return false;
    return isWorkingDay(date);
  });
}

/** Luni…vineri ale săptămânii care conține `date`. @param {string} date @returns {string[]} */
export function weekOf(date) {
  const monday = shiftDays(date, -(weekdayOf(date) - 1));
  return Array.from({ length: 5 }, (_, index) => shiftDays(monday, index));
}

/**
 * Starea unei ședințe: rândul din `pool_sessions` dacă există, altfel „nemarcat" (trecut/azi) sau
 * „programat" (viitor — doar afișare, se poate doar anula).
 * @param {string} bookingId @param {string} date
 * @param {Map<string, { status: string }>} sessionsByKey cheie `bookingId|date`
 * @param {string} todayStr
 * @returns {'present' | 'absent' | 'excused' | 'cancelled' | 'unmarked' | 'scheduled'}
 */
export function sessionStateFor(bookingId, date, sessionsByKey, todayStr) {
  const row = sessionsByKey.get(`${bookingId}|${date}`);
  if (row) return /** @type {any} */ (row.status);
  return date > todayStr ? 'scheduled' : 'unmarked';
}

/** @param {import('../pool.types.d.mts').PoolSession[]} sessions @returns {Map<string, import('../pool.types.d.mts').PoolSession>} */
export function sessionsByKeyOf(sessions) {
  return new Map(sessions.map(session => [`${session.bookingId}|${session.date}`, session]));
}

/**
 * Câte programări ocupă deja un slot (zi a săptămânii + oră) la o dată dată — folosit la
 * verificarea de capacitate (`seatsPerSlot`) înainte de a crea o nouă programare.
 * @param {import('../pool.types.d.mts').PoolBooking[]} bookings
 * @param {number} weekday @param {string} time @param {string} onDate
 * @param {string} [excludeBookingId]
 */
export function seatsTaken(bookings, weekday, time, onDate, excludeBookingId = '') {
  return bookings.filter(
    booking =>
      !booking.archivedAt &&
      booking.id !== excludeBookingId &&
      booking.weekday === weekday &&
      booking.time === time &&
      booking.startDate <= onDate &&
      (!booking.endDate || booking.endDate >= onDate),
  ).length;
}
