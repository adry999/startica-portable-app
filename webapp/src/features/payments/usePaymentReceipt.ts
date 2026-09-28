import { useEffect, useRef } from 'react';
import { useAppSession } from '@shared/api/session';
import { useExchangeRates } from '@shared/api/useExchangeRates';
import { useKindergarten, type KindergartenSettings } from '@shared/api/useKindergarten';
import { obligation } from '#shared/domain/tuition-obligation.mjs';
import { allocations } from '#shared/domain/payment-allocations.mjs';
import { contractNumberOf, groupNameOf } from '#shared/domain/record-labels.mjs';
import { formatMonthName } from '#shared/format/date-format.mjs';
import { amountInWordsRo } from '#shared/format/amount-in-words.mjs';
import { schoolYearStartOf, schoolYearMonths } from '#features/billing/index.web.mjs';
import { today } from '@domain/calendar-month.mjs';
import type { Child, Currency, Group, Payment, PaymentAllocation } from '@contracts/record-types.mjs';

export type PaymentReceiptStatus = 'loading' | 'ready' | 'not-found';

export interface AllocationRow {
  month: string;
  label: string;
  amount: number;
  statusLabel: string;
  /** Restul lunii respective, după această plată (0 dacă e achitată integral) — pentru tabelul 16g. */
  rest: number;
}

export interface RestBox {
  amount: number;
  currency: Currency;
  dueLabel: string;
}

export interface EurBlock {
  amountLei: number;
  fxRate: number;
  fxRateSource: 'bnm' | 'manual';
  amountEur: number;
  restEur: number | null;
}

export interface YearMonthCell {
  month: string;
  label: string;
  kind: 'paid' | 'partial' | 'other';
}

export interface PaymentReceiptData {
  status: PaymentReceiptStatus;
  payment: Payment | null;
  child: Child | null;
  contractLabel: string;
  groupName: string;
  groups: Group[];
  kindergarten: KindergartenSettings | null;
  allocationRows: AllocationRow[];
  total: number;
  amountInWords: string;
  restBox: RestBox | null;
  eurBlock: EurBlock | null;
  yearMonths: YearMonthCell[];
}

const NOT_FOUND: PaymentReceiptData = {
  status: 'not-found',
  payment: null,
  child: null,
  contractLabel: '',
  groupName: '',
  groups: [],
  kindergarten: null,
  allocationRows: [],
  total: 0,
  amountInWords: '',
  restBox: null,
  eurBlock: null,
  yearMonths: [],
};

/**
 * Datele pentru confirmarea de plată (16b/16g) — plus asignarea numărului la
 * prima randare, dacă achitarea nu îl are deja. O singură cerere per montare:
 * `assignedRef` previne dublarea la o re-randare provocată de alt motiv.
 */
export function usePaymentReceipt(paymentId: string): PaymentReceiptData {
  const session = useAppSession();
  const { state, ready } = session.state;
  const { rates } = useExchangeRates();
  const kindergarten = useKindergarten();
  const assignedRef = useRef(false);

  const payment = ready ? (state.payments.find((p: Payment) => p.id === paymentId) ?? null) : null;

  useEffect(() => {
    if (!ready || !payment || payment.receiptNumber || assignedRef.current) return;
    assignedRef.current = true;
    void session.mutate('/api/payments-receipt-number', { paymentId: payment.id }).catch(() => {
      assignedRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, payment?.id, payment?.receiptNumber]);

  if (!ready || !kindergarten.ready) {
    return { ...NOT_FOUND, status: 'loading' };
  }
  if (!payment) return NOT_FOUND;

  const child = state.children.find((c: Child) => c.id === payment.childId) ?? null;
  const asOf = today();

  const allocationRows: AllocationRow[] = child
    ? allocations(payment).map((allocation: PaymentAllocation) => {
        const monthObligation = obligation(child, allocation.month, state.payments, state.charges, asOf, null, rates);
        return {
          month: allocation.month,
          label: `Taxă ${formatMonthName(allocation.month)}`,
          amount: allocation.amount,
          statusLabel: monthObligation.rest === 0 ? 'achitată integral' : 'parțial',
          rest: monthObligation.rest ?? 0,
        };
      })
    : allocations(payment).map((allocation: PaymentAllocation) => ({
        month: allocation.month,
        label: `Taxă ${formatMonthName(allocation.month)}`,
        amount: allocation.amount,
        statusLabel: '',
        rest: 0,
      }));

  const lastMonth = allocationRows.at(-1)?.month;
  const lastObligation =
    child && lastMonth ? obligation(child, lastMonth, state.payments, state.charges, asOf, null, rates) : null;
  const restBox: RestBox | null =
    lastObligation && lastObligation.rest !== null && lastObligation.rest > 0
      ? { amount: lastObligation.rest, currency: lastObligation.currency, dueLabel: lastObligation.due }
      : null;

  const eurBlock: EurBlock | null =
    payment.fxRate && payment.fxRateSource && payment.amountEur
      ? {
          amountLei: payment.amount,
          fxRate: payment.fxRate,
          fxRateSource: payment.fxRateSource,
          amountEur: payment.amountEur,
          restEur: restBox && restBox.currency === 'EUR' ? restBox.amount : null,
        }
      : null;

  const yearStart = schoolYearStartOf(payment.date.slice(0, 7));
  const yearMonths: YearMonthCell[] = child
    ? schoolYearMonths(yearStart).map((month: string) => {
        const monthObligation = obligation(child, month, state.payments, state.charges, asOf, null, rates);
        const kind: YearMonthCell['kind'] =
          monthObligation.expected && monthObligation.rest === 0
            ? 'paid'
            : (monthObligation.paid ?? 0) > 0
              ? 'partial'
              : 'other';
        return { month, label: formatMonthName(month), kind };
      })
    : [];

  return {
    status: 'ready',
    payment,
    child,
    contractLabel: child ? contractNumberOf(child) : '',
    groupName: child ? groupNameOf(child.groupId, state.groups) : '',
    groups: state.groups,
    kindergarten: kindergarten.settings,
    allocationRows,
    total: payment.amount,
    amountInWords: amountInWordsRo(payment.amount),
    restBox,
    eurBlock,
    yearMonths,
  };
}
