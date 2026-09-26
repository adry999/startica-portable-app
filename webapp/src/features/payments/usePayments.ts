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
  sourceName: string;
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
  other: number;
}

export interface PaymentsData {
  status: PaymentsStatus;
  failureMessage: string;
  records: RecordsSnapshot;
  rows: PaymentRowView[];
  summary: PaymentsSummary;
  groups: { id: string; name: string }[];
  search: string;
  setSearch: (value: string) => void;
  childId: string;
  setChildId: (value: string) => void;
  method: string;
  setMethod: (value: string) => void;
  groupFilter: string;
  setGroupFilter: (value: string) => void;
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

const EMPTY_SUMMARY: PaymentsSummary = { count: 0, total: 0, cash: 0, card: 0, transfer: 0, other: 0 };

function buildRow(payment: Payment, records: RecordsSnapshot): PaymentRowView {
  return {
    id: payment.id,
    date: payment.date,
    dateLabel: formatDate(payment.date),
    childId: payment.childId,
    childLabel: childNameOf(payment, records.children),
    sourceName: payment.sourceName || '',
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
 * Filtrare (căutare, copil, metodă, interval de luni, arhivare) + sumar pe
 * metodă, aici ca stare de hook. Filtrele trăiesc aici, nu în pagină, ca
 * PaymentsPage să rămână randare pură — la fel ca openGroupId în useGroups.
 */
export function usePayments(initialChildId = ''): PaymentsData {
  const session = useAppSession();
  const { state, ready, loading, saveError } = session.state;
  const records = state as RecordsSnapshot;

  const [search, setSearch] = useState('');
  const [childId, setChildId] = useState(initialChildId);
  const [method, setMethod] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [monthFrom, setMonthFrom] = useState('');
  const [monthTo, setMonthTo] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active');

  async function archivePayment(id: string) {
    const payment = records.payments.find(p => p.id === id);
    if (!payment) throw new Error('Achitarea nu mai există.');
    await session.mutate('/api/record', {
      type: 'payments',
      mode: 'update',
      record: { ...payment, archived: true, archivedAt: new Date().toISOString() },
    });
  }

  async function unarchivePayment(id: string) {
    const payment = records.payments.find(p => p.id === id);
    if (!payment) throw new Error('Achitarea nu mai există.');
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

  const actions = {
    search,
    setSearch,
    childId,
    setChildId,
    method,
    setMethod,
    groupFilter,
    setGroupFilter,
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

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      records,
      rows: [],
      summary: EMPTY_SUMMARY,
      groups: [],
      ...actions,
    };
  }

  function paymentGroupId(payment: Payment): string | null {
    const child = payment.childId ? records.children.find(c => c.id === payment.childId) : undefined;
    return child?.groupId ?? null;
  }

  function matchesGroupFilter(payment: Payment): boolean {
    if (groupFilter === 'all') return true;
    const paymentGroup = paymentGroupId(payment);
    return groupFilter === 'none' ? !paymentGroup : paymentGroup === groupFilter;
  }

  const normalizedSearch = normalizeSearchText(search);

  function matchesFilters(payment: Payment, includeMethod: boolean): boolean {
    return (
      (archiveFilter === 'all' || (archiveFilter === 'archived' ? payment.archived : !payment.archived)) &&
      (!monthFrom || payment.date.slice(0, 7) >= monthFrom) &&
      (!monthTo || payment.date.slice(0, 7) <= monthTo) &&
      (!childId || payment.childId === childId) &&
      (!includeMethod ||
        !method ||
        paymentTenders(payment).some((tender: PaymentTender) => tender.method === method)) &&
      matchesGroupFilter(payment) &&
      matchesRecordListSearch('payments', payment, records, normalizedSearch)
    );
  }

  const filteredPayments = records.payments.filter(payment => matchesFilters(payment, true));
  const paymentsForSummary = records.payments.filter(payment => matchesFilters(payment, false));

  const rows = filteredPayments.map(payment => buildRow(payment, records));
  const byMethod = summarizePaymentsByMethod(paymentsForSummary);
  const groups = [...records.groups].sort((a, b) => a.name.localeCompare(b.name, 'ro'));

  return {
    status: 'ready',
    failureMessage: '',
    records,
    rows,
    groups,
    summary: {
      count: rows.length,
      total: total(filteredPayments),
      cash: byMethod.Cash,
      card: byMethod.Card,
      transfer: byMethod.Transfer,
      other: byMethod.Altele,
    },
    ...actions,
  };
}
