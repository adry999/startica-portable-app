import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { contractNumberOf } from '#shared/domain/record-labels.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { matchesPhoneSuffixAny, phoneQueryDigits } from '#shared/domain/phone-number.mjs';
import type { Child, Expense, Payment, RecordsSnapshot } from '@contracts/record-types.mjs';

const MAX_RESULTS_PER_GROUP = 5;
/** 41c: „500” sau „500.00” — fără virgulă, ca în `AmountInput` (number nativ, mereu punct). */
const AMOUNT_QUERY_RE = /^\d+(\.\d{1,2})?$/;

export interface ChildSearchResult {
  type: 'children';
  id: string;
  label: string;
  detail: string;
}

export interface PaymentSearchResult {
  type: 'payments';
  id: string;
  label: string;
  detail: string;
}

export interface ExpenseSearchResult {
  type: 'expenses';
  id: string;
  label: string;
  detail: string;
}

export type SearchResult = ChildSearchResult | PaymentSearchResult | ExpenseSearchResult;

function childLabel(child: Child): string {
  return `Contract ${contractNumberOf(child)} · ${child.parent || 'fără părinte'}`;
}

function paymentLabel(payment: Payment, children: Child[]): { label: string; detail: string } {
  const child = children.find(c => c.id === payment.childId);
  return {
    label: child?.name || payment.sourceName || payment.childName || 'Achitare neasociată',
    detail: `${formatDate(payment.date)} · ${formatMoney(payment.amount)}`,
  };
}

function expenseLabel(expense: Expense): { label: string; detail: string } {
  return {
    label: expense.description || expense.category || 'Cheltuială',
    detail: `${formatDate(expense.date)} · ${formatMoney(expense.amount)}`,
  };
}

function childMatchesPhone(child: Child, queryDigits: string): boolean {
  return matchesPhoneSuffixAny(child, queryDigits);
}

const byDateDesc = (a: { date: string }, b: { date: string }) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

/**
 * Căutarea globală din topbar: copii (nume/contract/părinte/telefon — sufix, 41c), achitări
 * (nume din sursă sau al copilului asociat, sau sumă exactă, 41c) și cheltuieli (doar sumă).
 * O sumă caută în ambele liste, cel mult 5 rezultate în total, cele mai noi primele.
 */
export function searchRecords(records: RecordsSnapshot, query: string): SearchResult[] {
  const normalizedQuery = normalizeSearchText(query).trim();
  if (!normalizedQuery) return [];

  const phoneDigitsQuery = phoneQueryDigits(normalizedQuery);

  const children: ChildSearchResult[] = records.children
    .filter((child: Child) => !child.archived)
    .filter((child: Child) => {
      const textMatch = normalizeSearchText(`${child.name} ${child.parent} ${contractNumberOf(child)}`).includes(
        normalizedQuery,
      );
      if (textMatch) return true;
      return phoneDigitsQuery !== null && childMatchesPhone(child, phoneDigitsQuery);
    })
    .slice(0, MAX_RESULTS_PER_GROUP)
    .map((child: Child) => ({ type: 'children', id: child.id, label: child.name, detail: childLabel(child) }));

  const amountQuery = AMOUNT_QUERY_RE.test(normalizedQuery) ? Number(normalizedQuery) : null;
  const amountMatches = (amount: number) => amountQuery !== null && Math.abs(amount - amountQuery) < 0.005;

  const textMatchedPayments = records.payments.filter((payment: Payment) => {
    if (payment.archived) return false;
    const child = records.children.find((c: Child) => c.id === payment.childId);
    return normalizeSearchText(`${payment.sourceName ?? ''} ${payment.childName ?? ''} ${child?.name ?? ''}`).includes(
      normalizedQuery,
    );
  });

  // 41c: suma caută în achitări ȘI cheltuieli, un singur top-5 combinat, cele mai noi primele —
  // separat de potrivirea pe text a achitărilor (care păstrează comportamentul de dinainte).
  const amountMatchedPayments: { kind: 'payments'; id: string; date: string }[] =
    amountQuery === null
      ? []
      : records.payments
          .filter((p: Payment) => !p.archived && amountMatches(p.amount))
          .map(p => ({ kind: 'payments' as const, id: p.id, date: p.date }));
  const amountMatchedExpenses: { kind: 'expenses'; id: string; date: string }[] =
    amountQuery === null
      ? []
      : records.expenses
          .filter((e: Expense) => !e.archived && amountMatches(e.amount))
          .map(e => ({ kind: 'expenses' as const, id: e.id, date: e.date }));
  const topAmountMatches = [...amountMatchedPayments, ...amountMatchedExpenses].sort(byDateDesc).slice(0, 5);
  const topAmountPaymentIds = new Set(
    topAmountMatches.filter(match => match.kind === 'payments').map(match => match.id),
  );
  const topAmountExpenseIds = new Set(
    topAmountMatches.filter(match => match.kind === 'expenses').map(match => match.id),
  );

  const paymentCandidates = [
    ...textMatchedPayments,
    ...records.payments.filter(payment => topAmountPaymentIds.has(payment.id)),
  ];
  const uniquePayments = [...new Map(paymentCandidates.map(payment => [payment.id, payment])).values()];
  if (amountQuery !== null) uniquePayments.sort(byDateDesc);
  const payments: PaymentSearchResult[] = uniquePayments.slice(0, MAX_RESULTS_PER_GROUP).map((payment: Payment) => {
    const { label, detail } = paymentLabel(payment, records.children);
    return { type: 'payments', id: payment.id, label, detail };
  });

  const expenses: ExpenseSearchResult[] = records.expenses
    .filter((expense: Expense) => topAmountExpenseIds.has(expense.id))
    .sort(byDateDesc)
    .map((expense: Expense) => {
      const { label, detail } = expenseLabel(expense);
      return { type: 'expenses', id: expense.id, label, detail };
    });

  return [...children, ...payments, ...expenses];
}
