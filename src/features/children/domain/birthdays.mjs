import { today } from '#shared/domain/calendar-month.mjs';
import { buildMonthGrid } from '#shared/domain/month-grid.mjs';

const isLeapYear = year => new Date(year, 1, 29).getDate() === 29;

// Născuții pe 29 februarie își serbează ziua pe 28 în anii nebisecți, altfel n-ar apărea deloc.
/**
 * @param {Date} birthDate
 * @param {Date} date
 */
function isBirthdayOn(birthDate, date) {
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
