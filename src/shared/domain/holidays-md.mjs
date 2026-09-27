import { shiftDays } from './calendar-month.mjs';

/**
 * Data Paștelui ortodox (calendar iulian, convertit în gregorian). Algoritmul Meeus pentru
 * Paștele iulian dă ziua în stil vechi; +13 zile trece în stilul nou folosit de calendarul MD.
 * @param {number} year
 * @returns {string} 'YYYY-MM-DD'
 */
export function orthodoxEaster(year) {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const julian = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return shiftDays(julian, 13);
}

const holidaysCache = new Map();

/**
 * Codul muncii al R. Moldova, art. 111. Fără zilele locale de hram (o setare ulterioară).
 * @param {number} year
 * @returns {{ date: string, name: string }[]}
 */
export function legalHolidaysMd(year) {
  if (holidaysCache.has(year)) return holidaysCache.get(year);
  const easterSunday = orthodoxEaster(year);
  const holidays = [
    { date: `${year}-01-01`, name: 'Anul Nou' },
    { date: `${year}-01-07`, name: 'Crăciunul (stil vechi)' },
    { date: `${year}-01-08`, name: 'Crăciunul (stil vechi)' },
    { date: `${year}-03-08`, name: 'Ziua internațională a femeii' },
    { date: easterSunday, name: 'Paștele' },
    { date: shiftDays(easterSunday, 1), name: 'Paștele (a doua zi)' },
    { date: shiftDays(easterSunday, 8), name: 'Paștele Blajinilor' },
    { date: `${year}-05-01`, name: 'Ziua internațională a muncii' },
    { date: `${year}-05-09`, name: 'Ziua Victoriei / Ziua Europei' },
    { date: `${year}-06-01`, name: 'Ziua Ocrotirii Copilului' },
    { date: `${year}-08-27`, name: 'Ziua Independenței' },
    { date: `${year}-08-31`, name: 'Ziua Limbii Române' },
    { date: `${year}-12-25`, name: 'Crăciunul' },
    { date: `${year}-12-26`, name: 'Crăciunul (a doua zi)' },
  ].sort((left, right) => (left.date < right.date ? -1 : 1));
  holidaysCache.set(year, holidays);
  return holidays;
}

/** @param {string} date @returns {boolean} */
export function isLegalHolidayMd(date) {
  const year = Number(date.slice(0, 4));
  return legalHolidaysMd(year).some(holiday => holiday.date === date);
}

/** @param {string} date @returns {boolean} */
export function isWeekend(date) {
  const day = new Date(date + 'T12:00:00Z').getUTCDay();
  return day === 0 || day === 6;
}

/** @param {string} date @returns {boolean} */
export function isWorkingDay(date) {
  return !isWeekend(date) && !isLegalHolidayMd(date);
}
