import { total } from './money.mjs';

export function summary(s) {
  return {
    children: s.children.length,
    payments: s.payments.length,
    expenses: s.expenses.length,
    groups: s.groups.length,
    categories: s.categories.length,
    paymentTotal: total(s.payments),
    expenseTotal: total(s.expenses),
  };
}
