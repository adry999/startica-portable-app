import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { buildReviewCenter, REVIEW_FILTERS, filterReviewItems } from '#features/review-center/domain/review-center.mjs';
import { childNameOf, groupNameOf } from '#shared/domain/record-labels.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { Child, Payment, RecordsSnapshot } from '@contracts/record-types.mjs';

export type ReviewStatus = 'loading' | 'ready' | 'failed';

export interface ReviewRowView {
  type: 'children' | 'payments';
  id: string;
  name: string;
  details: string;
  reasons: string[];
  categories: string[];
  canConfirm: boolean;
  confirmed: boolean;
}

export interface ReviewProgressView {
  total: number;
  confirmed: number;
  pending: number;
}

export interface ReviewData {
  status: ReviewStatus;
  failureMessage: string;
  rows: ReviewRowView[];
  totalItems: number;
  progress: ReviewProgressView;
  labels: Record<string, string>;
  filterOptions: readonly (readonly [string, string])[];
  search: string;
  setSearch: (value: string) => void;
  filter: string;
  setFilter: (value: string) => void;
  resetFilters: () => void;
  confirmReview: (paymentId: string) => Promise<void>;
}

// # nu sunt exportate din #features/review-center/index.web.mjs (doar
// buildReviewCenter/findRecordIssues/view-ul sunt publice azi) — import
// direct de domain, ca în useDashboard (backendul nu se atinge pentru o
// simplă lipsă din API-ul public).
export function useReview(): ReviewData {
  const session = useAppSession();
  const { state, ready, loading, saveError } = session.state;

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  function resetFilters() {
    setSearch('');
    setFilter('all');
  }

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      rows: [],
      totalItems: 0,
      progress: { total: 0, confirmed: 0, pending: 0 },
      labels: {},
      filterOptions: REVIEW_FILTERS,
      search,
      setSearch,
      filter,
      setFilter,
      resetFilters,
      confirmReview: async () => {},
    };
  }

  const records = state as RecordsSnapshot;
  const center = buildReviewCenter(records);
  const filtered = filterReviewItems(center, filter, search);

  const rows: ReviewRowView[] = filtered.map(item => {
    const isPayment = item.type === 'payments';
    const details = isPayment
      ? paymentDetails(item.record as Payment, records.children)
      : childDetails(item.record as Child, records.groups);
    return {
      type: item.type,
      id: item.id,
      name: item.name,
      details,
      reasons: item.reasons,
      categories: item.categories,
      canConfirm: item.canConfirm,
      confirmed: isPayment ? Boolean((item.record as Payment).reviewed) : false,
    };
  });

  async function confirmReview(paymentId: string) {
    const payment = records.payments.find(p => p.id === paymentId);
    if (!payment || payment.reviewed) return;
    await session.mutate('/api/record', { type: 'payments', mode: 'update', record: { ...payment, reviewed: true } });
  }

  return {
    status: 'ready',
    failureMessage: '',
    rows,
    totalItems: center.items.length,
    progress: center.progress,
    labels: center.labels,
    filterOptions: REVIEW_FILTERS,
    search,
    setSearch,
    filter,
    setFilter,
    resetFilters,
    confirmReview,
  };
}

function paymentDetails(payment: Payment, children: Child[]): string {
  const parts = [formatDate(payment.date), formatMoney(payment.amount)];
  if (payment.sourceName) parts.push(`sursă: ${payment.sourceName}`);
  if (payment.childId) parts.push(`copil: ${childNameOf(payment, children)}`);
  return parts.join(' · ');
}

function childDetails(child: Child, groups: RecordsSnapshot['groups']): string {
  return `Contract: ${child.contractNumber || child.id} · Grupă: ${groupNameOf(child.groupId, groups) || 'necompletată'}`;
}
