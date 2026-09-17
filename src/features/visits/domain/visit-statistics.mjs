import { daysBetween, shiftDays } from '#shared/domain/calendar-month.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Visit} Visit */

const RETENTION_DAYS = 365;

/**
 * @param {Visit[]} visits
 * @param {string} todayStr
 * @returns {{ scheduled: number, done: number, enrolled: number, withdrew: number }}
 */
export function summarizeVisitFunnel(visits, todayStr) {
  const active = visits.filter(visit => !visit.archived);
  const inLastYear = visit => daysBetween(visit.statusChangedAt.slice(0, 10), todayStr) <= RETENTION_DAYS;
  return {
    scheduled: active.filter(visit => visit.status === 'Programată' && visit.date >= todayStr).length,
    done: active.filter(visit => visit.status === 'Efectuată' && inLastYear(visit)).length,
    enrolled: active.filter(visit => visit.status === 'Înscris' && inLastYear(visit)).length,
    withdrew: active.filter(visit => visit.status === 'Renunțat' && inLastYear(visit)).length,
  };
}

/**
 * @param {Visit[]} visits
 * @param {string} todayStr
 * @returns {{ today: number, tomorrow: number, items: Visit[] }}
 */
export function countVisitsForDays(visits, todayStr) {
  const tomorrowStr = shiftDays(todayStr, 1);
  const items = visits
    .filter(
      visit =>
        !visit.archived && visit.status === 'Programată' && (visit.date === todayStr || visit.date === tomorrowStr),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  return {
    today: items.filter(visit => visit.date === todayStr).length,
    tomorrow: items.filter(visit => visit.date === tomorrowStr).length,
    items,
  };
}
