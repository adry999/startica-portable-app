import { expandBooking, sessionStateFor, sessionsByKeyOf } from './pool-schedule.mjs';

/**
 * Situația unui copil pe o lună: câte ședințe erau programate, câte s-au ținut, sumă de plată.
 * Motivat și anulat nu se taxează; lipsa nemotivată se taxează doar dacă setarea o cere.
 * @param {{
 *   bookings: import('../pool.types.d.mts').PoolBooking[],
 *   sessions: import('../pool.types.d.mts').PoolSession[],
 *   month: string,
 *   settings: import('../pool.types.d.mts').PoolSettings,
 *   todayStr: string,
 * }} input
 */
export function childMonth({ bookings, sessions, month, settings, todayStr }) {
  const sessionsByKey = sessionsByKeyOf(sessions);
  let scheduled = 0,
    present = 0,
    absent = 0,
    excused = 0,
    cancelled = 0,
    unmarked = 0;
  for (const booking of bookings) {
    for (const date of expandBooking(booking, month)) {
      scheduled++;
      const state = sessionStateFor(booking.id, date, sessionsByKey, todayStr);
      if (state === 'present') present++;
      else if (state === 'absent') absent++;
      else if (state === 'excused') excused++;
      else if (state === 'cancelled') cancelled++;
      else if (state === 'unmarked') unmarked++;
    }
  }
  const amount =
    Math.round((present + (settings.chargeUnexcusedAbsence ? absent : 0)) * settings.pricePerSession * 100) / 100;
  return { scheduled, present, absent, excused, cancelled, unmarked, amount };
}

/**
 * Plata antrenorului pe o lună — aceeași funcție e chemată de cardul 22c și de închiderea lunii
 * (decizia 6, 2026-09-27-personal-bazin.md): niciodată două formule diferite pentru aceeași sumă.
 * @param {{
 *   coachId: string,
 *   bookings: import('../pool.types.d.mts').PoolBooking[],
 *   sessions: import('../pool.types.d.mts').PoolSession[],
 *   month: string,
 *   settings: import('../pool.types.d.mts').PoolSettings,
 *   todayStr: string,
 * }} input
 */
export function coachPayForMonth({ coachId, bookings, sessions, month, settings, todayStr }) {
  const sessionsByKey = sessionsByKeyOf(sessions);
  const coachBookings = bookings.filter(booking => booking.coachId === coachId);
  /** @type {Map<string, Set<string>>} */
  const childrenBySession = new Map();
  for (const booking of coachBookings) {
    for (const date of expandBooking(booking, month)) {
      if (sessionStateFor(booking.id, date, sessionsByKey, todayStr) !== 'present') continue;
      const key = `${date}|${booking.time}`;
      if (!childrenBySession.has(key)) childrenBySession.set(key, new Set());
      childrenBySession.get(key)?.add(booking.childId);
    }
  }
  const sessionsHeld = childrenBySession.size;
  const childrenPresent = [...childrenBySession.values()].reduce((sum, set) => sum + set.size, 0);
  const amount =
    Math.round(settings.coachRate * (settings.coachPayMode === 'per_child' ? childrenPresent : sessionsHeld) * 100) /
    100;
  return { sessionsHeld, childrenPresent, rate: settings.coachRate, mode: settings.coachPayMode, amount };
}

/** @param {ReturnType<typeof childMonth>[]} rows */
export function monthTotals(rows) {
  return rows.reduce(
    (totals, row) => ({
      scheduled: totals.scheduled + row.scheduled,
      present: totals.present + row.present,
      absent: totals.absent + row.absent,
      revenue: Math.round((totals.revenue + row.amount) * 100) / 100,
    }),
    { scheduled: 0, present: 0, absent: 0, revenue: 0 },
  );
}

/**
 * O lună poate fi închisă doar dacă nicio ședință trecută nu a rămas nemarcată — banii nu se
 * calculează niciodată dintr-o ședință neconsemnată (decizia 5).
 * @param {{ bookings: import('../pool.types.d.mts').PoolBooking[], sessions: import('../pool.types.d.mts').PoolSession[], month: string, todayStr: string }} input
 * @returns {number}
 */
export function countUnmarkedPastSessions({ bookings, sessions, month, todayStr }) {
  const sessionsByKey = sessionsByKeyOf(sessions);
  let count = 0;
  for (const booking of bookings) {
    for (const date of expandBooking(booking, month)) {
      if (date > todayStr) continue;
      if (sessionStateFor(booking.id, date, sessionsByKey, todayStr) === 'unmarked') count++;
    }
  }
  return count;
}
