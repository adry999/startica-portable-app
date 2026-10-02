import { normalizeRecord, DEFAULT_SERVICE_ID } from '@domain/record-schema.mjs';
import { cents } from '@domain/money.mjs';
import { paymentTenders } from '@domain/payment-allocations.mjs';
import { chooseSmsRecipient } from '#features/sms-notify/index.web.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { Child, Payment, PaymentTender, RecordsSnapshot } from '@contracts/record-types.mjs';
import { toUserError } from '@shared/api/to-user-error';

export const DEFAULT_TENDER_METHODS = ['Cash', 'Card', 'Transfer'];

export interface AllocationRowValues {
  /** Identitate stabilă pentru cheia React a rândului — nu ține de poziție, ca eliminarea unui rând să nu re-monteze restul. */
  id?: string;
  month: string;
  amount: string;
}

/** 44b: un frate inclus în plată — o achitare separată, cu propriul `childId`/`month`/`amount`,
 * legată de restul grupului prin `receiptGroupId` (vezi `buildSiblingPaymentRecords`). */
export interface SiblingPaymentRowValues {
  childId: string;
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
  /** 44b: frații bifați pentru plata asta — gol dacă nu există/nu s-a ales niciunul. */
  siblings: SiblingPaymentRowValues[];
  /** 44b: generat o singură dată, la trimitere, doar când `siblings` nu e gol — vezi `PaymentFormDrawer.handleSubmit`. */
  receiptGroupId?: string;
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
  const resolvedChildId = payment?.childId || defaultChildId;
  const smsChild = records?.children.find(c => c.id === resolvedChildId);
  // F7 (FEEDBACK-01-10.md): o plată nouă acoperă implicit luna plății, nu cea mai veche restanță
  // — restanțele apar separat în `PaymentFormDrawer`, bifabile explicit.
  const defaultMonth = date.slice(0, 7);
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
    // 44b: frații nu se reconstruiesc la editare — „+ Adaugă fratele” există doar la o plată nouă.
    siblings: [],
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
    receiptGroupId: values.receiptGroupId,
  }) as Payment;
}

/** Metoda folosită pentru rândurile fraților (44b) — prima cu sumă &gt; 0, ca plata principală;
 * „Cash” dacă niciuna (nu ar trebui să se întâmple, suma principală fiind deja validată). */
function primaryTenderMethod(tenders: Record<string, string>): string {
  return Object.entries(tenders).find(([, amount]) => Number(amount) > 0)?.[0] ?? 'Cash';
}

/**
 * 44b: un `Payment` separat per frate bifat, cu `receiptGroupId` comun — un singur bon pentru tot
 * grupul (§11.2), dar câte o înregistrare pe copil, ca restul aplicației (restanțe, istoric) să
 * rămână corecte per copil. Gol dacă nu există frați bifați sau `receiptGroupId` n-a fost încă generat.
 */
export function buildSiblingPaymentRecords(values: PaymentFormValues): Payment[] {
  if (!values.siblings.length || !values.receiptGroupId) return [];
  const method = primaryTenderMethod(values.tenders);
  return values.siblings
    .filter(sibling => Number(sibling.amount) > 0)
    .map(
      sibling =>
        normalizeRecord('payments', {
          id: `PAY-${crypto.randomUUID()}`,
          childId: sibling.childId,
          date: values.date,
          service: values.service,
          tenders: [{ method, amount: Number(sibling.amount) }],
          allocations: [{ month: sibling.month, amount: Number(sibling.amount) }],
          receiptGroupId: values.receiptGroupId,
          reviewed: false,
        }) as Payment,
    );
}

/** Semnătura tenders-urilor unei plăți, normalizată și fără ordine — independentă de cum a fost
 * scris `method` istoric (B1: „Cash + Card” vs. „Card + Cash” tot un duplicat). */
function tenderSignature(payment: Payment): string {
  return paymentTenders(payment)
    .map((tender: PaymentTender) => `${tender.method}:${cents(tender.amount)}`)
    .sort()
    .join('|');
}

/** 40b: textul din UndoToast pentru o achitare nou-creată — suma (principal + frați bifați, 44b)
 * și copilul; „+ N frați” doar când există unul sau mai mulți bifați cu sumă &gt; 0. */
export function paymentUndoDetail(values: PaymentFormValues, records: RecordsSnapshot): string {
  const childName = records.children.find(child => child.id === values.childId)?.name ?? '';
  const checkedSiblings = values.siblings.filter(sibling => Number(sibling.amount) > 0);
  const amount =
    totalOfTenders(values.tenders) + checkedSiblings.reduce((sum, sibling) => sum + Number(sibling.amount), 0);
  const suffix =
    checkedSiblings.length > 0
      ? ` + ${checkedSiblings.length} ${checkedSiblings.length === 1 ? 'frate' : 'frați'}`
      : '';
  return `${formatMoney(amount)} · ${childName}${suffix}`;
}

/**
 * 40b §5 (Grup frați, 44b): o plată cu frați bifați produce mai multe `auditId`-uri (principal +
 * câte unul per frate) — un singur UndoToast, dar „Anulează” cere `/api/undo` o dată per id,
 * independent (nu batch — serverul nu are o rută de anulare în lot). Dacă una eșuează (ex. frate
 * modificat între timp de altcineva), restul tot se anulează; eroarea aruncată aici ajunge în
 * `UndoToast` (fază „error”, ca orice alt eșec de-al lui) și spune câte au mers, nu doar „a eșuat”.
 */
export function createPaymentUndo(
  auditIds: number[],
  mutate: (path: string, body: Record<string, unknown>) => Promise<unknown>,
): () => Promise<void> {
  return async () => {
    // Fără frați: un singur id — eroarea serverului (ex. „S-a modificat între timp.”) ajunge
    // direct în UndoToast, ca la cheltuială/copil/mutare în grupă, fără „1 din 1”.
    if (auditIds.length === 1) {
      await mutate('/api/undo', { auditId: auditIds[0] });
      return;
    }
    const settled = await Promise.allSettled(auditIds.map(auditId => mutate('/api/undo', { auditId })));
    const failed = settled.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
    if (failed.length === 0) return;
    const succeededCount = auditIds.length - failed.length;
    const reason = toUserError(failed[0].reason);
    throw new Error(
      `Anulat ${succeededCount} din ${auditIds.length} achitări — ${failed.length === 1 ? '1 nu a putut fi anulată' : `${failed.length} nu au putut fi anulate`} (${reason}).`,
    );
  };
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
