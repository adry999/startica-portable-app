// Fațadă temporară: restul funcțiilor se mută în feature-urile lor, conform docs/arhitectura/README.md §6.
import { today, monthOK, dateOK } from '#shared/domain/calendar-month.mjs';
import { cents, total } from '#shared/domain/money.mjs';
import {
  TYPES,
  STATUS_HISTORY_VALUES,
  CHILD_STATUSES,
  emptyState,
  normalizeRecord,
  validateState,
} from '#shared/domain/record-schema.mjs';
import { summary } from '#shared/domain/records-report.mjs';
import { allocations, paymentTenders, paymentIndex } from '#shared/domain/payment-allocations.mjs';
import { dueDayFor, obligation, firstUnpaidMonth } from '#shared/domain/tuition-obligation.mjs';
// Cale directă, nu index.web/index.server: fațada se încarcă atât în browser, cât și în server.
import { findRecordIssues } from '#features/review-center/domain/record-issues.mjs';

export {
  today,
  monthOK,
  dateOK,
  cents,
  total,
  TYPES,
  STATUS_HISTORY_VALUES,
  CHILD_STATUSES,
  emptyState,
  normalizeRecord,
  validateState,
  summary,
  allocations,
  paymentTenders,
  paymentIndex,
  dueDayFor,
  obligation,
  firstUnpaidMonth,
};

// Grila unui calendar lunar real (săptămâni Luni–Duminică, cu zilele din
// lunile vecine adăugate ca umplutură), cu zilele de naștere ale copiilor
// nearhivați marcate pe fiecare celulă. Potrivirea e după lună+zi din
// naștere, nu după an, ca ziua să apară în orice an calendaristic o arăți.
export function monthCalendar(children, todayStr = today()) {
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
  for (const c of children) {
    if (c.archived || !c.birthDate) continue;
    const b = new Date(c.birthDate + 'T12:00:00');
    const key = monthDay(b);
    if (!byMonthDay.has(key)) byMonthDay.set(key, []);
    byMonthDay.get(key).push({ name: c.name, birthYear: b.getFullYear() });
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
export function upcomingBirthdays(children, days = 5, todayStr = today()) {
  const t = new Date(todayStr + 'T12:00:00');
  const range = Array.from({ length: days + 1 }, (_, i) => {
    const d = new Date(t);
    d.setDate(t.getDate() + i);
    return d;
  });
  return children
    .filter(c => !c.archived && c.birthDate)
    .flatMap(c => {
      const b = new Date(c.birthDate + 'T12:00:00');
      const daysUntil = range.findIndex(d => d.getMonth() === b.getMonth() && d.getDate() === b.getDate());
      if (daysUntil === -1) return [];
      return [{ child: c, daysUntil, turningAge: range[daysUntil].getFullYear() - b.getFullYear() }];
    })
    .sort((a, b) => a.daysUntil - b.daysUntil || a.child.name.localeCompare(b.child.name, 'ro'));
}
export function importReport(input) {
  try {
    const state = validateState(input);
    return { state, summary: summary(state), warnings: findRecordIssues(state), errors: [] };
  } catch (error) {
    return { errors: [error.message], warnings: [] };
  }
}
export function cashSummary(s, month) {
  const payments = s.payments.filter(p => !p.archived && p.date.startsWith(month));
  const income = total(payments),
    byMethod = { Cash: 0, Card: 0, Transfer: 0, Altele: 0 };
  for (const p of payments)
    for (const part of paymentTenders(p)) {
      const method = Object.hasOwn(byMethod, part.method) ? part.method : 'Altele';
      byMethod[method] += cents(part.amount);
    }
  for (const method of Object.keys(byMethod)) byMethod[method] /= 100;
  const expense = total(s.expenses.filter(p => !p.archived && p.date.startsWith(month)));
  return { income, expense, net: (cents(income) - cents(expense)) / 100, byMethod };
}
