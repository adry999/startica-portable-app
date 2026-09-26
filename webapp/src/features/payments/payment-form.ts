import { normalizeRecord } from '@domain/record-schema.mjs';
import { cents } from '@domain/money.mjs';
import { paymentTenders } from '@domain/payment-allocations.mjs';
import type { Payment, PaymentTender, RecordsSnapshot } from '@contracts/record-types.mjs';

export const DEFAULT_TENDER_METHODS = ['Cash', 'Card', 'Transfer'];

export interface AllocationRowValues {
  month: string;
  amount: string;
}

export interface PaymentFormValues {
  childId: string;
  date: string;
  tenders: Record<string, string>;
  sourceName: string;
  reviewed: boolean;
  allocations: AllocationRowValues[];
  notes: string;
}

export function tenderMethodsFor(payment: Payment | null): string[] {
  const existing = payment ? paymentTenders(payment).map((tender: PaymentTender) => tender.method) : [];
  return [...new Set([...DEFAULT_TENDER_METHODS, ...existing])];
}

export function defaultPaymentFormValues(payment: Payment | null, today: string, defaultChildId = ''): PaymentFormValues {
  const tenders: Record<string, string> = {};
  for (const method of tenderMethodsFor(payment)) tenders[method] = '';
  if (payment) for (const tender of paymentTenders(payment)) tenders[tender.method] = String(tender.amount);

  const date = payment?.date || today;
  const allocations: AllocationRowValues[] =
    payment && payment.allocations?.length
      ? payment.allocations.map(allocation => ({ month: allocation.month, amount: String(allocation.amount) }))
      : [{ month: date.slice(0, 7), amount: '' }];

  return {
    childId: payment?.childId || defaultChildId,
    date,
    tenders,
    sourceName: payment?.sourceName || payment?.childName || '',
    reviewed: Boolean(payment?.reviewed),
    allocations,
    notes: payment?.notes || '',
  };
}

export function totalOfTenders(tenders: Record<string, string>): number {
  let sum = 0;
  for (const value of Object.values(tenders)) sum += cents(Number(value) || 0);
  return sum / 100;
}

/** Echivalentul payment-editor-fields.mjs's `read()` (fără verificarea de duplicat — vezi `findDuplicatePayment`). */
export function buildPaymentRecord(previous: Payment | null, id: string, values: PaymentFormValues): Payment {
  const tenders = Object.entries(values.tenders)
    .map(([method, amount]) => ({ method, amount: Number(amount) }))
    .filter(tender => tender.amount !== 0);
  const allocations = values.allocations.map(row => ({ month: row.month, amount: Number(row.amount) }));

  return normalizeRecord('payments', {
    ...previous,
    id: previous?.id ?? id,
    notes: values.notes,
    childId: values.childId,
    date: values.date,
    amount: undefined,
    tenders,
    sourceName: values.sourceName,
    reviewed: values.reviewed,
    allocations,
  }) as Payment;
}

export function findDuplicatePayment(records: RecordsSnapshot, record: Payment): Payment | null {
  return (
    records.payments.find(
      payment =>
        !payment.archived &&
        payment.childId === record.childId &&
        payment.date === record.date &&
        cents(payment.amount) === cents(record.amount) &&
        payment.method === record.method,
    ) ?? null
  );
}
