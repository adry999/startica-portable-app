import { today } from '#shared/domain/calendar-month.mjs';

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

// Grila unui calendar lunar real (săptămâni Luni–Duminică, cu zilele din
// lunile vecine adăugate ca umplutură), cu zilele de naștere ale copiilor
// nearhivați marcate pe fiecare celulă. Potrivirea e după lună+zi din
// naștere, nu după an, ca ziua să apară în orice an calendaristic o arăți.
/**
 * @param {string} todayStr
 * @returns {BirthdayCalendarDay[][]}
 */
export function buildBirthdayCalendar(children, todayStr = today()) {
  const t = new Date(todayStr + 'T12:00:00');
  const year = t.getFullYear(),
    month = t.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const leading = (firstOfMonth.getDay() + 6) % 7; // grila începe luni
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;
  const gridStart = new Date(year, month, 1 - leading);

  const isoDate = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dow = t.getDay();
  const weekStart = new Date(t);
  weekStart.setDate(t.getDate() + (dow === 0 ? -6 : 1 - dow));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  // Comparate ca text (YYYY-MM-DD), nu ca Date: gridStart e la miezul nopții,
  // iar weekStart moștenea ora 12:00 de la `t` — comparația de Date excludea
  // greșit prima zi a săptămânii.
  const weekStartStr = isoDate(weekStart);
  const weekEndStr = isoDate(weekEnd);

  const monthDay = d => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const byMonthDay = new Map();
  for (const child of children) {
    if (child.archived || !child.birthDate) continue;
    const birthDate = new Date(child.birthDate + 'T12:00:00');
    const key = monthDay(birthDate);
    if (!byMonthDay.has(key)) byMonthDay.set(key, []);
    byMonthDay.get(key).push({ name: child.name, birthYear: birthDate.getFullYear() });
  }

  const days = Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const matches = byMonthDay.get(monthDay(d)) || [];
    const dateStr = isoDate(d);
    return {
      date: dateStr,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: dateStr === todayStr,
      isCurrentWeek: dateStr >= weekStartStr && dateStr <= weekEndStr,
      names: matches.map(m => ({ name: m.name, turningAge: d.getFullYear() - m.birthYear })),
    };
  });

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
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
      const daysUntil = range.findIndex(
        d => d.getMonth() === birthDate.getMonth() && d.getDate() === birthDate.getDate(),
      );
      if (daysUntil === -1) return [];
      return [{ child, daysUntil, turningAge: range[daysUntil].getFullYear() - birthDate.getFullYear() }];
    })
    .sort((a, b) => a.daysUntil - b.daysUntil || a.child.name.localeCompare(b.child.name, 'ro'));
}
