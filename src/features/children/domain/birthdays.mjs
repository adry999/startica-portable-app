import { today } from '#shared/domain/calendar-month.mjs';
import { buildMonthGrid } from '#shared/domain/month-grid.mjs';

const isLeapYear = year => new Date(year, 1, 29).getDate() === 29;

// Născuții pe 29 februarie își serbează ziua pe 28 în anii nebisecți, altfel n-ar apărea deloc.
/**
 * @param {Date} birthDate
 * @param {Date} date
 */
export function isBirthdayOn(birthDate, date) {
  if (date.getMonth() !== birthDate.getMonth()) return false;
  if (date.getDate() === birthDate.getDate()) return true;
  return (
    birthDate.getMonth() === 1 && birthDate.getDate() === 29 && date.getDate() === 28 && !isLeapYear(date.getFullYear())
  );
}

/**
 * @typedef {{
 *   date: string,
 *   day: number,
 *   inMonth: boolean,
 *   isToday: boolean,
 *   isCurrentWeek: boolean,
 *   names: { name: string, turningAge: number }[],
 * }} BirthdayCalendarDay
 */

// Grila lunii curente (din grila partajată), cu zilele de naștere ale
// copiilor nearhivați marcate pe fiecare celulă. Potrivirea e după lună+zi
// din naștere, nu după an, ca ziua să apară în orice an calendaristic o arăți.
/**
 * @param {string} todayStr
 * @returns {BirthdayCalendarDay[][]}
 */
export function buildBirthdayCalendar(children, todayStr = today()) {
  const weeks = buildMonthGrid(todayStr.slice(0, 7), todayStr);

  const monthDay = d => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const byMonthDay = new Map();
  for (const child of children) {
    if (child.archived || !child.birthDate) continue;
    const birthDate = new Date(child.birthDate + 'T12:00:00');
    const key = monthDay(birthDate);
    if (!byMonthDay.has(key)) byMonthDay.set(key, []);
    byMonthDay.get(key).push({ name: child.name, birthYear: birthDate.getFullYear() });
  }

  return weeks.map(week =>
    week.map(cell => {
      const d = new Date(cell.date + 'T12:00:00');
      const key = monthDay(d);
      const leapDayBirthdays = key === '02-28' && !isLeapYear(d.getFullYear()) ? byMonthDay.get('02-29') || [] : [];
      const matches = [...(byMonthDay.get(key) || []), ...leapDayBirthdays];
      return { ...cell, names: matches.map(m => ({ name: m.name, turningAge: d.getFullYear() - m.birthYear })) };
    }),
  );
}

/**
 * @typedef {{
 *   childId: string,
 *   name: string,
 *   firstName: string,
 *   lastInitial: string,
 *   turningAge: number,
 *   groupId: string | null,
 * }} BirthdayEntry
 */

// Grila unei luni alese (nu neapărat cea curentă), cu zilele de naștere pe fiecare celulă
// din lună (celulele de umplutură din lunile vecine rămân fără intrări) și o listă plată,
// sortată, pentru panoul lateral. Nu înlocuiește buildBirthdayCalendar — aceea rămâne pentru
// Dashboard, care arată mereu luna curentă și nu are nevoie de grupă.
/**
 * @param {string} monthKey format YYYY-MM
 * @param {string} todayStr format YYYY-MM-DD
 */
export function buildBirthdayMonth(children, monthKey, todayStr = today()) {
  const active = children.filter(child => !child.archived && child.birthDate);

  /** @param {typeof active[number]} child */
  function entryFor(child, cellYear) {
    const nameParts = child.name.trim().split(/\s+/);
    return {
      childId: child.id,
      name: child.name,
      firstName: nameParts[nameParts.length - 1],
      lastInitial: `${nameParts[0]?.charAt(0) ?? ''}.`,
      turningAge: cellYear - new Date(child.birthDate + 'T12:00:00').getFullYear(),
      groupId: child.groupId ?? null,
    };
  }

  const weeks = buildMonthGrid(monthKey, todayStr).map(week =>
    week.map(cell => {
      const cellDate = new Date(cell.date + 'T12:00:00');
      const entries = cell.inMonth
        ? active
            .filter(child => isBirthdayOn(new Date(child.birthDate + 'T12:00:00'), cellDate))
            .map(child => entryFor(child, cellDate.getFullYear()))
        : [];
      const dow = cellDate.getDay();
      return { ...cell, entries, isPast: cell.date < todayStr, isWeekend: dow === 0 || dow === 6 };
    }),
  );

  const list = weeks
    .flat()
    .filter(cell => cell.inMonth)
    .flatMap(cell => cell.entries.map(entry => ({ ...entry, date: cell.date, day: cell.day })))
    .sort((a, b) => a.day - b.day || a.name.localeCompare(b.name, 'ro'));

  return { weeks, list };
}

// Copiii cu ziua de naștere în următoarele `days` zile (0 = azi), ca de
// pregătit ceva din timp — nu doar în ziua respectivă. Sortați crescător.
/**
 * @param {number} days
 * @param {string} todayStr
 */
export function listUpcomingBirthdays(children, days = 5, todayStr = today()) {
  const t = new Date(todayStr + 'T12:00:00');
  const range = Array.from({ length: days + 1 }, (_, i) => {
    const d = new Date(t);
    d.setDate(t.getDate() + i);
    return d;
  });
  return children
    .filter(child => !child.archived && child.birthDate)
    .flatMap(child => {
      const birthDate = new Date(child.birthDate + 'T12:00:00');
      const daysUntil = range.findIndex(date => isBirthdayOn(birthDate, date));
      if (daysUntil === -1) return [];
      return [{ child, daysUntil, turningAge: range[daysUntil].getFullYear() - birthDate.getFullYear() }];
    })
    .sort((a, b) => a.daysUntil - b.daysUntil || a.child.name.localeCompare(b.child.name, 'ro'));
}
