import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { buildReviewCenter, filterReviewItems } from '#features/review-center/domain/review-center.mjs';
import { childNameOf, contractNumberOf, groupNameOf } from '#shared/domain/record-labels.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { Child, Payment, RecordsSnapshot } from '@contracts/record-types.mjs';

export type ReviewStatus = 'loading' | 'ready' | 'failed';
export type ReviewTypeFilter = 'all' | 'children' | 'payments';
export type ReviewSeverity = 'high' | 'medium' | 'low';

const HIGH_SEVERITY_CATEGORIES = new Set(['unassigned', 'duplicate']);
const MEDIUM_SEVERITY_CATEGORIES = new Set(['provisional', 'advance']);

function severityOf(categories: string[]): ReviewSeverity {
  if (categories.some(category => HIGH_SEVERITY_CATEGORIES.has(category))) return 'high';
  if (categories.some(category => MEDIUM_SEVERITY_CATEGORIES.has(category))) return 'medium';
  return 'low';
}

export interface ReviewRowView {
  type: 'children' | 'payments';
  id: string;
  name: string;
  /** A doua linie din identitate: „Fișă copil · contract #N” / „Achitare · 17.08.2026”. */
  subtitle: string;
  details: string;
  reasons: string[];
  categories: string[];
  severity: ReviewSeverity;
  canConfirm: boolean;
  confirmed: boolean;
}

export interface ReviewProgressView {
  total: number;
  confirmed: number;
  pending: number;
}

export interface ReviewTypeCounts {
  all: number;
  children: number;
  payments: number;
}

export interface ReviewData {
  status: ReviewStatus;
  failureMessage: string;
  rows: ReviewRowView[];
  counts: ReviewTypeCounts;
  progress: ReviewProgressView;
  labels: Record<string, string>;
  search: string;
  setSearch: (value: string) => void;
  typeFilter: ReviewTypeFilter;
  setTypeFilter: (value: ReviewTypeFilter) => void;
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
  const [typeFilter, setTypeFilter] = useState<ReviewTypeFilter>('all');

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      rows: [],
      counts: { all: 0, children: 0, payments: 0 },
      progress: { total: 0, confirmed: 0, pending: 0 },
      labels: {},
      search,
      setSearch,
      typeFilter,
      setTypeFilter,
      confirmReview: async () => {},
    };
  }

  const records = state as RecordsSnapshot;
  const center = buildReviewCenter(records);
  // Segmentul din antet e „Toate · Fișe · Achitări” (tip de înregistrare), nu cele 7 categorii ale
  // review-center-ului — categoria rămâne folosită doar pentru culoarea punctului și eticheta problemei.
  const searched = filterReviewItems(center, 'all', search);
  const counts: ReviewTypeCounts = {
    all: searched.length,
    children: searched.filter(item => item.type === 'children').length,
    payments: searched.filter(item => item.type === 'payments').length,
  };
  const filtered = searched.filter(item => typeFilter === 'all' || item.type === typeFilter);

  const rows: ReviewRowView[] = filtered.map(item => {
    const isPayment = item.type === 'payments';
    const details = isPayment
      ? paymentDetails(item.record as Payment, records.children)
      : childDetails(item.record as Child, records.groups);
    return {
      type: item.type,
      id: item.id,
      name: item.name,
      subtitle: isPayment
        ? `Achitare · ${formatDate((item.record as Payment).date)}`
        : `Fișă copil · contract #${contractNumberOf(item.record as Child)}`,
      details,
      reasons: item.reasons,
      categories: item.categories,
      severity: severityOf(item.categories),
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
    counts,
    progress: center.progress,
    labels: center.labels,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    confirmReview,
  };
}

function paymentDetails(payment: Payment, children: Child[]): string {
  const segments = [formatDate(payment.date), formatMoney(payment.amount)];
  if (payment.sourceName) segments.push(`sursă: ${payment.sourceName}`);
  if (payment.childId) segments.push(`copil: ${childNameOf(payment, children)}`);
  return segments.join(' · ');
}

function childDetails(child: Child, groups: RecordsSnapshot['groups']): string {
  return `Contract: ${contractNumberOf(child)} · Grupă: ${groupNameOf(child.groupId, groups) || 'necompletată'}`;
}
