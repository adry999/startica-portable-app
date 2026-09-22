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
 * @param {number} [horizonDays] Câte zile după azi să includă (0 = doar azi, 1 = azi și mâine, implicit).
 * @returns {{ today: number, tomorrow: number, items: Visit[] }}
 */
export function countVisitsForDays(visits, todayStr, horizonDays = 1) {
  const tomorrowStr = shiftDays(todayStr, 1);
  const includedDates = new Set(Array.from({ length: horizonDays + 1 }, (_, i) => shiftDays(todayStr, i)));
  const items = visits
    // Sortare doar după oră (§3.5): în intervalul azi+mâine, o vizită de mâine dimineață
    // vine înaintea uneia de azi după-amiază. Pentru un orizont mai larg, secțiunile
    // rezumatului Telegram regrupează după dată, deci ordinea aici rămâne cea din §3.5.
    .filter(visit => !visit.archived && visit.status === 'Programată' && includedDates.has(visit.date))
    .sort((a, b) => a.time.localeCompare(b.time));
  return {
    today: items.filter(visit => visit.date === todayStr).length,
    tomorrow: items.filter(visit => visit.date === tomorrowStr).length,
    items,
  };
}
