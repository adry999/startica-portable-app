import { normalizeRecord, DEFAULT_SERVICE_ID } from '@domain/record-schema.mjs';
import { cents } from '@domain/money.mjs';
import { paymentTenders } from '@domain/payment-allocations.mjs';
import { firstUnpaidMonth } from '@domain/tuition-obligation.mjs';
import { chooseSmsRecipient } from '#features/sms-notify/index.web.mjs';
import type { Child, Payment, PaymentTender, RecordsSnapshot } from '@contracts/record-types.mjs';

export const DEFAULT_TENDER_METHODS = ['Cash', 'Card', 'Transfer'];

export interface AllocationRowValues {
  /** Identitate stabilă pentru cheia React a rândului — nu ține de poziție, ca eliminarea unui rând să nu re-monteze restul. */
  id?: string;
  month: string;
  amount: string;
}

export interface PaymentFormValues {
  childId: string;
  date: string;
  /** Id dintr-un `Service` (B3, ALINIERE-DESIGN.md) — implicit `DEFAULT_SERVICE_ID` (Grădiniță). */
  service: string;
  tenders: Record<string, string>;
  sourceName: string;
  reviewed: boolean;
  allocations: AllocationRowValues[];
  notes: string;
  /** Curs BNM (sau corectat manual) folosit la conversie — doar când taxa copilului e EUR. */
  fxRate?: number;
  /** Proveniența lui fxRate — doar când fxRate există. */
  fxRateSource?: 'bnm' | 'manual';
  /** `amount` (lei) convertit la fxRate, rotunjit la ban — doar când fxRate există. */
  amountEur?: number;
  /** 15b: bifă „Trimite confirmare prin SMS” — semnal de trimitere după salvare, nu se stochează pe Payment. */
  sendSmsConfirmation: boolean;
}

/** 15b: implicit bifată doar dacă părintele copilului are un telefon valid (sms.md). */
export function defaultSendSmsConfirmation(child: Child | null | undefined): boolean {
  return child ? chooseSmsRecipient(child) !== null : false;
}

export function tenderMethodsFor(payment: Payment | null): string[] {
  const existing = payment
    ? paymentTenders(payment)
        .map((tender: PaymentTender) => tender.method)
        .filter((method: string) => DEFAULT_TENDER_METHODS.includes(method))
    : [];
  return [...new Set([...DEFAULT_TENDER_METHODS, ...existing])];
}

export function defaultPaymentFormValues(
  payment: Payment | null,
  today: string,
  defaultChildId = '',
  records?: RecordsSnapshot,
  defaultService = DEFAULT_SERVICE_ID,
): PaymentFormValues {
  const tenders: Record<string, string> = {};
  for (const method of tenderMethodsFor(payment)) tenders[method] = '';
  if (payment) for (const tender of paymentTenders(payment)) tenders[tender.method] = String(tender.amount);

  const date = payment?.date || today;
  const child = !payment && defaultChildId && records ? records.children.find(c => c.id === defaultChildId) : null;
  const suggestedMonth = child && firstUnpaidMonth(child, records!.payments, records!.charges);
  const resolvedChildId = payment?.childId || defaultChildId;
  const smsChild = records?.children.find(c => c.id === resolvedChildId);
  const defaultMonth = suggestedMonth || date.slice(0, 7);
  const allocations: AllocationRowValues[] =
    payment && payment.allocations?.length
      ? payment.allocations.map(allocation => ({
          id: crypto.randomUUID(),
          month: allocation.month,
          amount: String(allocation.amount),
        }))
      : [{ id: crypto.randomUUID(), month: defaultMonth, amount: '' }];

  return {
    childId: resolvedChildId,
    date,
    service: payment?.service || defaultService,
    tenders,
    sourceName: payment?.sourceName || payment?.childName || '',
    reviewed: Boolean(payment?.reviewed),
    allocations,
    notes: payment?.notes || '',
    sendSmsConfirmation: defaultSendSmsConfirmation(smsChild),
  };
}

export function totalOfTenders(tenders: Record<string, string>): number {
  let sum = 0;
  for (const value of Object.values(tenders)) sum += cents(Number(value) || 0);
  return sum / 100;
}

/** Fără verificarea de duplicat — vezi `findDuplicatePayment`. */
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
    service: values.service,
    amount: undefined,
    tenders,
    sourceName: values.sourceName,
    reviewed: values.reviewed,
    allocations,
    fxRate: values.fxRate,
    fxRateSource: values.fxRateSource,
    amountEur: values.amountEur,
  }) as Payment;
}

/** Semnătura tenders-urilor unei plăți, normalizată și fără ordine — independentă de cum a fost
 * scris `method` istoric (B1: „Cash + Card” vs. „Card + Cash” tot un duplicat). */
function tenderSignature(payment: Payment): string {
  return paymentTenders(payment)
    .map((tender: PaymentTender) => `${tender.method}:${cents(tender.amount)}`)
    .sort()
    .join('|');
}

export function findDuplicatePayment(records: RecordsSnapshot, record: Payment): Payment | null {
  const signature = tenderSignature(record);
  return (
    records.payments.find(
      payment =>
        !payment.archived &&
        payment.childId === record.childId &&
        payment.date === record.date &&
        cents(payment.amount) === cents(record.amount) &&
        tenderSignature(payment) === signature,
    ) ?? null
  );
}
