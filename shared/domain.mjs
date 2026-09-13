// Fațadă temporară: restul funcțiilor se mută în feature-urile lor, conform docs/arhitectura/README.md §6.
import { today, monthOK, dateOK } from '#shared/domain/calendar-month.mjs';
import { cents, total } from '#shared/domain/money.mjs';
import {
  TYPES,
  STATUS_HISTORY_VALUES,
  CHILD_STATUSES,
  emptyState,
  requireThat,
  requireAmount,
  normalizeRecord,
  validateState,
} from '#shared/domain/record-schema.mjs';
import { summary } from '#shared/domain/records-report.mjs';
import { allocations, paymentTenders, paymentIndex } from '#shared/domain/payment-allocations.mjs';
import { dueDayFor, obligation, firstUnpaidMonth } from '#shared/domain/tuition-obligation.mjs';

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
// O intrare de istoric pe lună: rescrie luna dacă există deja.
const upsertMonth = (rows, from, key, value) => [...(rows || []).filter(r => r.from !== from), { from, [key]: value }];

// Completarea în masă a taxei, grupei și statutului. Fără taxă ȘI statut,
// obligation() nu poate calcula nimic, deci ambele se scriu în istoric din
// aceeași lună — de regulă luna începerii frecventării, ca și lunile trecute
// să fie evaluate corect.
export function applyChildSetup(child, setup) {
  requireThat(setup && typeof setup === 'object', 'Completare invalidă.');
  requireThat(monthOK(setup.from), `${child.id}: luna de aplicare este invalidă.`);
  const r = structuredClone(child);
  if (setup.groupId !== undefined) {
    if (setup.groupId !== null)
      requireThat(typeof setup.groupId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(setup.groupId), 'Grupă invalidă.');
    r.groupId = setup.groupId;
  }
  if (setup.fee !== undefined && setup.fee !== null) {
    requireAmount(setup.fee, `${child.name}: taxa`, true);
    r.fee = setup.fee;
    r.feeHistory = upsertMonth(r.feeHistory, setup.from, 'amount', setup.fee);
  }
  if (setup.status !== undefined && setup.status !== '') {
    requireThat(STATUS_HISTORY_VALUES.includes(setup.status), `${child.name}: statut invalid.`);
    r.status = setup.status;
    r.statusHistory = upsertMonth(r.statusHistory, setup.from, 'status', setup.status);
  }
  return normalizeRecord('children', r);
}
export function issues(s) {
  const result = [];
  const add = (type, r, reason) =>
    result.push({ type, id: r.id, name: r.name || r.childName || r.sourceName || r.description || r.id, reason });
  for (const c of s.children.filter(r => !r.archived)) {
    if (!c.feeHistory?.length) add('children', c, c.fee == null ? 'Taxă lipsă' : 'Taxă fără lună de aplicare');
    if (!c.groupId) add('children', c, 'Grupă lipsă');
    if (!c.attendanceDate) add('children', c, 'Data începerii frecventării lipsește');
    if (!STATUS_HISTORY_VALUES.includes(c.status)) add('children', c, 'Statut de verificat');
    if (c.parent && c.name && c.parent.trim().toLocaleLowerCase('ro-RO') === c.name.trim().toLocaleLowerCase('ro-RO'))
      add('children', c, 'Părintele are același nume ca copilul; verifică sursa');
    if (
      c.birthDate &&
      ((c.contractDate && c.birthDate > c.contractDate) || (c.attendanceDate && c.birthDate > c.attendanceDate))
    )
      add('children', c, 'Data nașterii este după contract / începutul frecventării');
  }
  const fingerprints = new Map();
  for (const p of s.payments.filter(r => !r.archived)) {
    if (!p.childId) add('payments', p, 'Copil neasociat');
    if (allocations(p).reduce((n, a) => n + cents(a.amount), 0) < cents(p.amount))
      add('payments', p, 'Avans nerepartizat');
    if (p.verification && !/^OK$/i.test(p.verification.trim()) && !p.reviewed)
      add('payments', p, `Verificare import: ${p.verification}`);
    const fingerprint = JSON.stringify([p.childId || p.sourceName || p.childName, p.date, cents(p.amount), p.method]);
    if (fingerprints.has(fingerprint)) add('payments', p, `Posibil duplicat cu ${fingerprints.get(fingerprint)}`);
    else fingerprints.set(fingerprint, p.id);
  }
  return result;
}
export function importReport(input) {
  try {
    const state = validateState(input);
    return { state, summary: summary(state), warnings: issues(state), errors: [] };
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
