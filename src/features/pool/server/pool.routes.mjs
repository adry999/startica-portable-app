import crypto from 'node:crypto';
import { fail } from '#core/server/errors/domain-error.mjs';
import { dateOK, monthOK, today as localToday } from '#shared/domain/calendar-month.mjs';
import {
  POOL_SETTINGS_KEY,
  POOL_SETTINGS_SEED,
  validatePoolSettings,
  normalizePoolSettings,
  parsePoolSettings,
} from '../domain/pool-settings.mjs';
import { weekOf, weekdayOf, sessionStateFor, sessionsByKeyOf, seatsTaken } from '../domain/pool-schedule.mjs';
import { childMonth, coachPayForMonth, countUnmarkedPastSessions } from '../domain/pool-month.mjs';
import { createPoolClosingService } from './pool-closing.service.mjs';

const TIME_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
const SESSION_STATUSES = ['present', 'absent', 'excused', 'cancelled'];

/**
 * Rutele Bazinului (23) — settings, programări, ședințe, luna și închiderea ei.
 * @param {{
 *   poolRepository: import('./pool.repository.mjs').PoolRepository,
 *   recordRepository: import('#shared/contracts/persistence.mjs').RecordRepository,
 *   runRevisionTransaction: import('#shared/contracts/persistence.mjs').RunRevisionTransaction,
 *   auditTrail: import('#shared/contracts/audit-trail.mjs').AuditTrail,
 *   readSetting: (key: string) => string,
 *   writeSetting: (key: string, value: string) => void,
 *   listCoaches: () => { id: string, name: string }[],
 *   payCoach: (input: { staffId: string, month: string, gross: number, date: string, method: string }) => { paid: boolean },
 *   onChange?: (change: { kind: 'pool_sessions', id: string, payload: unknown }) => void,
 *   today?: () => string,
 * }} dependencies
 */
export function createPoolRoutes({
  poolRepository,
  recordRepository,
  runRevisionTransaction,
  auditTrail,
  readSetting,
  writeSetting,
  listCoaches,
  payCoach,
  onChange,
  today = localToday,
}) {
  const closingService = createPoolClosingService({
    poolRepository,
    recordRepository,
    runRevisionTransaction,
    auditTrail,
    readSetting,
    listCoaches,
    payCoach,
    today,
  });

  function readSettings() {
    return parsePoolSettings(readSetting(POOL_SETTINGS_KEY));
  }

  function getSettings() {
    return { settings: readSettings(), seed: POOL_SETTINGS_SEED, coaches: listCoaches() };
  }

  /** @param {{ body: unknown }} request */
  function postSettings({ body }) {
    if (!validatePoolSettings(body)) fail('Setări de bazin invalide.');
    const settings = normalizePoolSettings(body);
    writeSetting(POOL_SETTINGS_KEY, JSON.stringify(settings));
    return { settings };
  }

  /** @param {{ url: URL }} request */
  function getWeek({ url }) {
    const date = url.searchParams.get('date');
    if (!date || !dateOK(date)) fail('Zi invalidă.');
    const settings = readSettings();
    if (!settings) return { days: [], stats: { scheduled: 0, present: 0, absent: 0, excused: 0 } };
    const dates = weekOf(date);
    const months = [...new Set(dates.map(d => d.slice(0, 7)))];
    const sessions = months.flatMap(month => poolRepository.sessionsForMonth(month));
    const sessionsByKey = sessionsByKeyOf(sessions);
    const bookings = poolRepository.listBookings();
    const { children } = recordRepository.readSnapshot();
    const todayStr = today();
    const times = [];
    {
      let [hour, minute] = settings.hoursFrom.split(':').map(Number);
      const [endHour, endMinute] = settings.hoursTo.split(':').map(Number);
      while (hour < endHour || (hour === endHour && minute < endMinute)) {
        times.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
        minute += settings.durationMin;
        while (minute >= 60) {
          minute -= 60;
          hour += 1;
        }
      }
    }
    let scheduled = 0,
      present = 0,
      absent = 0,
      excused = 0;
    const days = dates.map(date => {
      const weekday = weekdayOf(date);
      const slots = times.map(time => {
        const entries = bookings
          .filter(
            booking =>
              booking.weekday === weekday &&
              booking.time === time &&
              booking.startDate <= date &&
              (!booking.endDate || booking.endDate >= date),
          )
          .map(booking => {
            const state = sessionStateFor(booking.id, date, sessionsByKey, todayStr);
            if (state !== 'scheduled') {
              scheduled++;
              if (state === 'present') present++;
              else if (state === 'absent') absent++;
              else if (state === 'excused') excused++;
            }
            return { booking, child: children.find(child => child.id === booking.childId) ?? null, state };
          });
        return { time, entries };
      });
      return { date, slots };
    });
    return { days, stats: { scheduled, present, absent, excused } };
  }

  /** @param {{ body: any }} request */
  function postBooking({ body }) {
    // { id, endDate } — oprește o programare existentă (nu o șterge, ca istoricul ședințelor să rămână).
    if (body?.id && body.booking === undefined) {
      const existing = poolRepository.findBooking(body.id);
      if (!existing) fail('Programarea nu mai există.', 409);
      if (body.endDate !== null && !dateOK(body.endDate)) fail('Dată de sfârșit invalidă.');
      return {
        booking: poolRepository.saveBooking({
          ...existing,
          endDate: body.endDate,
          archivedAt: body.endDate ? new Date().toISOString() : existing.archivedAt,
          updatedAt: new Date().toISOString(),
        }),
      };
    }
    const input = body?.booking ?? {};
    if (!recordRepository.exists('children', input.childId)) fail('Copilul nu există.', 409);
    if (!listCoaches().some(coach => coach.id === input.coachId)) fail('Antrenor invalid.', 409);
    if (!Number.isInteger(input.weekday) || input.weekday < 1 || input.weekday > 5)
      fail('Ziua săptămânii este invalidă.');
    if (typeof input.time !== 'string' || !TIME_OK.test(input.time)) fail('Ora este invalidă.');
    if (!dateOK(input.startDate)) fail('Data de început este invalidă.');
    if (input.endDate && !dateOK(input.endDate)) fail('Data de sfârșit este invalidă.');
    const settings = readSettings();
    if (!settings) fail('Bazinul nu este configurat pentru această filială.');
    if (settings.seatsPerSlot !== null) {
      const taken = seatsTaken(poolRepository.listBookings(), input.weekday, input.time, input.startDate, input.id);
      if (taken >= settings.seatsPerSlot) fail('Nu mai sunt locuri libere la ora aleasă.');
    }
    const id = typeof input.id === 'string' && input.id ? input.id : `PB-${crypto.randomUUID()}`;
    const booking = {
      id,
      childId: input.childId,
      coachId: input.coachId,
      weekday: input.weekday,
      time: input.time,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      archivedAt: null,
      updatedAt: new Date().toISOString(),
    };
    return { booking: poolRepository.saveBooking(booking) };
  }

  /** @param {{ body: { changes?: unknown } }} request */
  function postSessions({ body }) {
    const changes = /** @type {any[]} */ (body?.changes);
    if (!Array.isArray(changes) || changes.length === 0) fail('Lista de schimbări este goală.');
    const todayStr = today();
    for (const change of changes) {
      if (typeof change?.bookingId !== 'string' || !poolRepository.findBooking(change.bookingId))
        fail('Programare inexistentă.');
      if (typeof change.date !== 'string' || !dateOK(change.date)) fail('Zi invalidă.');
      if (change.status !== null && !SESSION_STATUSES.includes(change.status)) fail('Stare invalidă.');
      if (change.date > todayStr && change.status !== null && change.status !== 'cancelled')
        fail('Ziua viitoare acceptă doar anularea.');
    }
    const { saved, removed } = poolRepository.applySessionChanges(changes, () => new Date().toISOString(), onChange);
    return { ok: true, saved, removed };
  }

  /** @param {{ url: URL }} request */
  function getMonth({ url }) {
    const month = url.searchParams.get('month');
    if (!month || !monthOK(month)) fail('Lună invalidă.');
    const settings = readSettings();
    if (!settings) return { children: [], coaches: [], closing: null, unmarked: 0 };
    const todayStr = today();
    const bookings = poolRepository.listBookings({ includeArchived: true });
    const sessions = poolRepository.sessionsForMonth(month);
    const { children } = recordRepository.readSnapshot();
    const childIds = [...new Set(bookings.map(booking => booking.childId))];
    const childRows = childIds.map(childId => {
      const row = childMonth({
        bookings: bookings.filter(booking => booking.childId === childId),
        sessions,
        month,
        settings,
        todayStr,
      });
      return {
        childId,
        child: children.find(child => child.id === childId) ?? null,
        ...row,
        charged: !!recordRepository.find('charges', `CHG-bazin-${childId}-${month}`),
      };
    });
    const coachRows = listCoaches().map(coach => ({
      coachId: coach.id,
      coach,
      ...coachPayForMonth({ coachId: coach.id, bookings, sessions, month, settings, todayStr }),
    }));
    return {
      children: childRows,
      coaches: coachRows,
      closing: poolRepository.closingFor(month),
      unmarked: countUnmarkedPastSessions({ bookings, sessions, month, todayStr }),
    };
  }

  /** @param {{ body: any }} request */
  function postCloseMonth({ body }) {
    return closingService.closeMonth(body);
  }

  return [
    { method: 'GET', path: '/api/pool/settings', handle: getSettings },
    { method: 'POST', path: '/api/pool/settings', handle: postSettings },
    { method: 'GET', path: '/api/pool/week', handle: getWeek },
    { method: 'POST', path: '/api/pool/bookings', handle: postBooking },
    { method: 'POST', path: '/api/pool/sessions', handle: postSessions },
    { method: 'GET', path: '/api/pool/month', handle: getMonth },
    { method: 'POST', path: '/api/pool/close-month', handle: postCloseMonth },
  ];
}
