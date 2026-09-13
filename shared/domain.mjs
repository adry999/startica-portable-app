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

export {
  buildBirthdayCalendar as monthCalendar,
  listUpcomingBirthdays as upcomingBirthdays,
} from '#features/children/domain/birthdays.mjs';
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
