import { useAppSession } from '@shared/api/session';
import { useKindergarten, type KindergartenSettings } from '@shared/api/useKindergarten';
import { paymentTenders } from '#shared/domain/payment-allocations.mjs';
import { cents } from '#shared/domain/money.mjs';
import { childNameOf, serviceOf } from '#shared/domain/record-labels.mjs';
import { DEFAULT_SERVICE_ID } from '#shared/domain/record-schema.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import type { Expense, Payment, RecordsSnapshot } from '@contracts/record-types.mjs';

export type DayClosingStatus = 'loading' | 'ready';

export interface DayPaymentRow {
  id: string;
  payerLabel: string;
  amount: number;
  /** Numele serviciului (B3) doar când NU e Grădiniță (implicit) — bonul rămâne curat în cazul comun. */
  serviceLabel: string | null;
  /** Tonul serviciului (`ServiceBadge`/COMPONENTE.md §2) — ignorat când `serviceLabel` e null. */
  serviceTone: string;
}

export interface DayExpenseRow {
  id: string;
  description: string;
  amount: number;
}

export interface DayMethodTotals {
  Cash: number;
  Card: number;
  Transfer: number;
}

export interface DayClosingData {
  status: DayClosingStatus;
  date: string;
  dateLabel: string;
  rows: DayPaymentRow[];
  totalsByMethod: DayMethodTotals;
  countsByMethod: DayMethodTotals;
  cashExpenses: DayExpenseRow[];
  cashExpensesTotal: number;
  /** Cash încasat minus cheltuielile cash ale zilei — banii care ar trebui să fie fizic în casă. */
  inCasa: number;
  kindergarten: KindergartenSettings | null;
}

const EMPTY_TOTALS: DayMethodTotals = { Cash: 0, Card: 0, Transfer: 0 };

// „Joi, 24.09.2026" — ziua săptămânii scrisă, data numerică, ca pe bonul de închidere a zilei (24b).
function dayLabelOf(date: string): string {
  const weekday = new Date(`${date}T12:00:00`).toLocaleDateString('ro-RO', { weekday: 'long' });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${formatDate(date)}`;
}

/**
 * Datele bonului de închidere a zilei (24b) — plățile zilei pe metodă, cheltuielile cash ale
 * aceleiași zile și suma care ar trebui să rămână fizic în casă (cash încasat minus cash cheltuit).
 */
export function useDayClosingReceipt(date: string): DayClosingData {
  const session = useAppSession();
  const { state, ready } = session.state;
  const kindergarten = useKindergarten();

  if (!ready || !kindergarten.ready) {
    return {
      status: 'loading',
      date,
      dateLabel: dayLabelOf(date),
      rows: [],
      totalsByMethod: EMPTY_TOTALS,
      countsByMethod: EMPTY_TOTALS,
      cashExpenses: [],
      cashExpensesTotal: 0,
      inCasa: 0,
      kindergarten: null,
    };
  }

  const records = state as RecordsSnapshot;
  const dayPayments = records.payments.filter((payment: Payment) => payment.date === date && !payment.archived);
  const dayExpenses = records.expenses.filter((expense: Expense) => expense.date === date && !expense.archived);

  const rows: DayPaymentRow[] = dayPayments.map((payment: Payment) => {
    const service = serviceOf(payment, records.services ?? []);
    return {
      id: payment.id,
      payerLabel: payment.sourceName || childNameOf(payment, records.children),
      amount: payment.amount,
      serviceLabel: service.id === DEFAULT_SERVICE_ID ? null : service.name,
      serviceTone: service.tone,
    };
  });

  const totalsByMethod: DayMethodTotals = { Cash: 0, Card: 0, Transfer: 0 };
  const countsByMethod: DayMethodTotals = { Cash: 0, Card: 0, Transfer: 0 };
  for (const payment of dayPayments) {
    for (const tender of paymentTenders(payment)) {
      if (!Object.hasOwn(totalsByMethod, tender.method)) continue;
      const method = tender.method as keyof DayMethodTotals;
      totalsByMethod[method] += cents(tender.amount);
      countsByMethod[method] += 1;
    }
  }
  for (const method of Object.keys(totalsByMethod) as (keyof DayMethodTotals)[]) totalsByMethod[method] /= 100;

  const cashExpenses: DayExpenseRow[] = dayExpenses
    .filter((expense: Expense) => expense.method === 'cash')
    .map((expense: Expense) => ({ id: expense.id, description: expense.description, amount: expense.amount }));
  const cashExpensesTotal = cashExpenses.reduce((sum, expense) => sum + cents(expense.amount), 0) / 100;

  return {
    status: 'ready',
    date,
    dateLabel: dayLabelOf(date),
    rows,
    totalsByMethod,
    countsByMethod,
    cashExpenses,
    cashExpensesTotal,
    inCasa: totalsByMethod.Cash - cashExpensesTotal,
    kindergarten: kindergarten.settings,
  };
}
