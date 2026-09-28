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
 * Zilele fixe (lună-zi), necorelate cu Paștele — Codul muncii al R. Moldova, art. 111.
 * Fără zilele locale de hram (o setare ulterioară).
 * Art. 111 enumeră 13 zile; 26 decembrie nu e zi nelucrătoare (verificat 2026-09-28, legis.md).
 * @type {{ month: number, day: number, name: string }[]}
 */
const FIXED_HOLIDAYS_MD = [
  { month: 1, day: 1, name: 'Anul Nou' },
  { month: 1, day: 7, name: 'Crăciunul (stil vechi)' },
  { month: 1, day: 8, name: 'Crăciunul (stil vechi)' },
  { month: 3, day: 8, name: 'Ziua internațională a femeii' },
  { month: 5, day: 1, name: 'Ziua internațională a muncii' },
  { month: 5, day: 9, name: 'Ziua Victoriei / Ziua Europei' },
  { month: 6, day: 1, name: 'Ziua Ocrotirii Copilului' },
  { month: 8, day: 27, name: 'Ziua Independenței' },
  { month: 8, day: 31, name: 'Ziua Limbii Române' },
  { month: 12, day: 25, name: 'Crăciunul' },
];

/**
 * @param {number} year
 * @returns {{ date: string, name: string }[]}
 */
export function legalHolidaysMd(year) {
  if (holidaysCache.has(year)) return holidaysCache.get(year);
  const easterSunday = orthodoxEaster(year);
  const fixed = FIXED_HOLIDAYS_MD.map(({ month, day, name }) => ({
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    name,
  }));
  const easterRelated = [
    { date: easterSunday, name: 'Paștele' },
    { date: shiftDays(easterSunday, 1), name: 'Paștele (a doua zi)' },
    { date: shiftDays(easterSunday, 8), name: 'Paștele Blajinilor' },
  ];
  const holidays = [...fixed, ...easterRelated].sort((left, right) => (left.date < right.date ? -1 : 1));
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
