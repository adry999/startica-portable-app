import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { total } from '#shared/domain/money.mjs';
import { allocations, paymentTenders } from '#shared/domain/payment-allocations.mjs';
import { childNameOf } from '#shared/domain/record-labels.mjs';
import { summarizePaymentsByMethod } from '#shared/ui/record-list-summary.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { matchesRecordListSearch } from '#shared/ui/record-list-search.mjs';
import { formatDate, formatMonthLabel } from '#shared/format/date-format.mjs';
import { buildPaymentRecord, findDuplicatePayment, type PaymentFormValues } from './payment-form';
import type { Payment, PaymentAllocation, PaymentTender, RecordsSnapshot } from '@contracts/record-types.mjs';

export type PaymentsStatus = 'loading' | 'ready' | 'failed';
export type ArchiveFilter = 'active' | 'archived' | 'all';

export const ARCHIVE_FILTER_OPTIONS: { value: ArchiveFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Arhivate' },
  { value: 'all', label: 'Toate' },
];

export const METHOD_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Toate' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Card', label: 'Card' },
  { value: 'Transfer', label: 'Transfer' },
];

export interface ChildOption {
  id: string;
  name: string;
}

export interface PaymentTenderView {
  method: string;
  amount: number;
}

export interface PaymentAllocationView {
  month: string;
  label: string;
  amount: number;
}

export interface PaymentRowView {
  id: string;
  date: string;
  dateLabel: string;
  childId: string;
  childLabel: string;
  unassigned: boolean;
  tenders: PaymentTenderView[];
  allocations: PaymentAllocationView[];
  total: number;
  archived: boolean;
}

export interface PaymentsSummary {
  count: number;
  total: number;
  cash: number;
  card: number;
  transfer: number;
}

export interface PaymentsData {
  status: PaymentsStatus;
  failureMessage: string;
  records: RecordsSnapshot;
  rows: PaymentRowView[];
  childOptions: ChildOption[];
  summary: PaymentsSummary;
  search: string;
  setSearch: (value: string) => void;
  childId: string;
  setChildId: (value: string) => void;
  method: string;
  setMethod: (value: string) => void;
  monthFrom: string;
  setMonthFrom: (value: string) => void;
  monthTo: string;
  setMonthTo: (value: string) => void;
  archiveFilter: ArchiveFilter;
  setArchiveFilter: (value: ArchiveFilter) => void;
  archivePayment: (id: string) => Promise<void>;
  unarchivePayment: (id: string) => Promise<void>;
  archiveMany: (ids: string[]) => Promise<void>;
  createPayment: (values: PaymentFormValues, confirmDuplicate: () => boolean) => Promise<boolean>;
  updatePayment: (previous: Payment, values: PaymentFormValues) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
}

const EMPTY_SUMMARY: PaymentsSummary = { count: 0, total: 0, cash: 0, card: 0, transfer: 0 };

function buildRow(payment: Payment, records: RecordsSnapshot): PaymentRowView {
  return {
    id: payment.id,
    date: payment.date,
    dateLabel: formatDate(payment.date),
    childId: payment.childId,
    childLabel: childNameOf(payment, records.children),
    unassigned: !payment.childId,
    tenders: paymentTenders(payment),
    allocations: allocations(payment).map((allocation: PaymentAllocation) => ({
      month: allocation.month,
      label: formatMonthLabel(allocation.month),
      amount: allocation.amount,
    })),
    total: payment.amount,
    archived: Boolean(payment.archived),
  };
}

/**
 * Echivalentul payments-list.controller.mjs: filtrare (căutare, copil, metodă,
 * interval de luni, arhivare) + sumar pe metodă, aici ca stare de hook în loc
 * de citiri directe din DOM. Filtrele trăiesc aici, nu în pagină, ca
 * PaymentsPage să rămână randare pură — la fel ca openGroupId în useGroups.
 */
export function usePayments(): PaymentsData {
  const session = useAppSession();
  const { state, ready, loading, saveError } = session.state;
  const records = state as RecordsSnapshot;

  const [search, setSearch] = useState('');
  const [childId, setChildId] = useState('');
  const [method, setMethod] = useState('');
  const [monthFrom, setMonthFrom] = useState('');
  const [monthTo, setMonthTo] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active');

  async function archivePayment(id: string) {
    const payment = records.payments.find(p => p.id === id);
    await session.mutate('/api/record', {
      type: 'payments',
      mode: 'update',
      record: { ...payment, archived: true, archivedAt: new Date().toISOString() },
    });
  }

  async function unarchivePayment(id: string) {
    const payment = records.payments.find(p => p.id === id);
    await session.mutate('/api/record', {
      type: 'payments',
      mode: 'update',
      record: { ...payment, archived: false, archivedAt: null },
    });
  }

  async function archiveMany(ids: string[]) {
    for (const id of ids) await archivePayment(id);
  }

  // `confirmDuplicate` e injectat de pagină (window.confirm), ca hook-ul să
  // rămână testabil fără un dialog real de browser — la fel ca `context.confirm`
  // din record-editor-dialog.mjs.
  async function createPayment(values: PaymentFormValues, confirmDuplicate: () => boolean): Promise<boolean> {
    const record = buildPaymentRecord(null, `PAY-${crypto.randomUUID()}`, values);
    const duplicate = findDuplicatePayment(records, record);
    if (duplicate && !confirmDuplicate()) return false;
    await session.mutate('/api/record', { type: 'payments', mode: 'create', record });
    return true;
  }

  async function updatePayment(previous: Payment, values: PaymentFormValues) {
    const record = buildPaymentRecord(previous, previous.id, values);
    await session.mutate('/api/record', { type: 'payments', mode: 'update', record });
  }

  async function deletePayment(id: string) {
    await session.mutate('/api/record-delete', { type: 'payments', id });
  }

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      records,
      rows: [],
      childOptions: [],
      summary: EMPTY_SUMMARY,
      search,
      setSearch,
      childId,
      setChildId,
      method,
      setMethod,
      monthFrom,
      setMonthFrom,
      monthTo,
      setMonthTo,
      archiveFilter,
      setArchiveFilter,
      archivePayment,
      unarchivePayment,
      archiveMany,
      createPayment,
      updatePayment,
      deletePayment,
    };
  }

  const normalizedSearch = normalizeSearchText(search);
  const filteredPayments = records.payments.filter(
    payment =>
      (archiveFilter === 'all' || (archiveFilter === 'archived' ? payment.archived : !payment.archived)) &&
      (!monthFrom || payment.date.slice(0, 7) >= monthFrom) &&
      (!monthTo || payment.date.slice(0, 7) <= monthTo) &&
      (!childId || payment.childId === childId) &&
      (!method || paymentTenders(payment).some((tender: PaymentTender) => tender.method === method)) &&
      matchesRecordListSearch('payments', payment, records, normalizedSearch),
  );

  const rows = filteredPayments.map(payment => buildRow(payment, records));
  const byMethod = summarizePaymentsByMethod(filteredPayments);
  const childOptions = [...records.children]
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    .map(child => ({ id: child.id, name: child.name }));

  return {
    status: 'ready',
    failureMessage: '',
    records,
    rows,
    childOptions,
    summary: {
      count: rows.length,
      total: total(filteredPayments),
      cash: byMethod.Cash,
      card: byMethod.Card,
      transfer: byMethod.Transfer,
    },
    search,
    setSearch,
    childId,
    setChildId,
    method,
    setMethod,
    monthFrom,
    setMonthFrom,
    monthTo,
    setMonthTo,
    archiveFilter,
    setArchiveFilter,
    archivePayment,
    unarchivePayment,
    archiveMany,
    createPayment,
    updatePayment,
    deletePayment,
  };
}
