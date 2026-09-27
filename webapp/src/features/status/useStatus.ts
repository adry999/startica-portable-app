import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { useExchangeRates } from '@shared/api/useExchangeRates';
import { evaluateChildrenForMonth, summarizeMonthStatus } from '#features/billing/index.web.mjs';
import { hasMissingFee } from '#features/fee-setup/index.web.mjs';
import { groupNameOf } from '#shared/domain/record-labels.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { matchesRecordListSearch } from '#shared/ui/record-list-search.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import type { Currency, RecordsSnapshot } from '@contracts/record-types.mjs';
import type { SmsRecipientRow } from '@shared/sms';

export type StatusScreenStatus = 'loading' | 'ready' | 'failed';
export type StatusSegment = 'all' | 'overdue' | 'partial' | 'paid' | 'upcoming';

export interface StatusRowView {
  id: string;
  name: string;
  archived: boolean;
  groupId: string | null;
  groupName: string;
  parent: string;
  phone: string;
  currency: Currency;
  expected: number | null;
  paid: number | null;
  rest: number | null;
  due: string;
  label: string;
}

export interface MonthStatusSummary {
  expected: number;
  paid: number;
  paidShare: number;
  owingChildren: number;
  overdueChildren: number;
  overdue: number;
}

export interface StatusData {
  status: StatusScreenStatus;
  failureMessage: string;
  /** Tabelul: după grupă, statut și căutare. */
  rows: StatusRowView[];
  /** Toți copiii, fără filtrele de grupă/statut/căutare — pentru „toți copiii” la tipărire (16c). */
  allRows: StatusRowView[];
  /** {child, obligation} pentru copiii cu Restanță/Plată parțială — sursa pentru „Notifică” pe rând (SMS P2). */
  notifiableRecipients: SmsRecipientRow[];
  /** Doar restanțierii — aceeași populație ca summary.overdueChildren, sursa pentru „Notifică toți" (SMS P2). */
  overdueRecipients: SmsRecipientRow[];
  /** Cardurile și contoarele: toată luna, indiferent de filtre (RASPUNSURI.md). */
  summary: MonthStatusSummary;
  missingFeeCount: number;
  segmentCounts: Record<StatusSegment, number>;
  groups: { id: string; name: string }[];
  groupFilter: string;
  setGroupFilter: (value: string) => void;
  segment: StatusSegment;
  setSegment: (value: StatusSegment) => void;
  search: string;
  setSearch: (value: string) => void;
  asOf: string;
}

// Rândurile cu buton „Notifică" (7a) — restanțe și plăți parțiale; „Scadent în curând"/„Nescadent" nu se notifică.
export const NOTIFIABLE_LABELS = new Set(['Restanță', 'Plată parțială']);

const SEGMENT_BY_LABEL: Record<string, Exclude<StatusSegment, 'all'>> = {
  Restanță: 'overdue',
  'Plată parțială': 'partial',
  Plătit: 'paid',
  'Scadent în curând': 'upcoming',
  Nescadent: 'upcoming',
};

const LABEL_ORDER = [
  'Restanță',
  'Plată parțială',
  'Scadent în curând',
  'Nescadent',
  'Plătit',
  'De verificat',
  'Fără obligație',
];

const EMPTY_SUMMARY: MonthStatusSummary = {
  expected: 0,
  paid: 0,
  paidShare: 0,
  owingChildren: 0,
  overdueChildren: 0,
  overdue: 0,
};
const EMPTY_COUNTS: Record<StatusSegment, number> = { all: 0, overdue: 0, partial: 0, paid: 0, upcoming: 0 };

/**
 * Obligația fiecărui copil pe luna aleasă, inclusiv arhivați. Grupa, statutul
 * și căutarea restrâng doar tabelul; cardurile și contoarele rămân pe toată
 * luna, la fel ca la Achitări (RASPUNSURI.md).
 */
export function useStatus(month: string): StatusData {
  const session = useAppSession();
  const { rates } = useExchangeRates();
  const { state, ready, loading, saveError } = session.state;
  const todayStr = todayFn();
  const [groupFilter, setGroupFilter] = useState('all');
  const [segment, setSegment] = useState<StatusSegment>('all');
  const [search, setSearch] = useState('');
  const filters = { groupFilter, setGroupFilter, segment, setSegment, search, setSearch };

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      rows: [],
      allRows: [],
      notifiableRecipients: [],
      overdueRecipients: [],
      summary: EMPTY_SUMMARY,
      missingFeeCount: 0,
      segmentCounts: EMPTY_COUNTS,
      groups: [],
      asOf: todayStr,
      ...filters,
    };
  }

  const records = state as RecordsSnapshot;
  const evaluations = evaluateChildrenForMonth(records, month, todayStr, rates);
  const summary = summarizeMonthStatus(evaluations, rates);
  const missingFeeCount = records.children.filter(child => !child.archived && hasMissingFee(child)).length;

  const segmentCounts = { ...EMPTY_COUNTS };
  for (const { obligation } of evaluations) {
    segmentCounts.all += 1;
    const rowSegment = SEGMENT_BY_LABEL[obligation.label];
    if (rowSegment) segmentCounts[rowSegment] += 1;
  }

  const normalizedSearch = normalizeSearchText(search);
  const byLabelThenName = (a: (typeof evaluations)[number], b: (typeof evaluations)[number]) =>
    LABEL_ORDER.indexOf(a.obligation.label) - LABEL_ORDER.indexOf(b.obligation.label) ||
    a.child.name.localeCompare(b.child.name, 'ro');
  const toRowView = ({ child, obligation }: (typeof evaluations)[number]): StatusRowView => ({
    id: child.id,
    name: child.name,
    archived: Boolean(child.archived),
    groupId: child.groupId,
    groupName: groupNameOf(child.groupId, records.groups),
    parent: child.parent || '',
    phone: child.phone || '',
    currency: obligation.currency as Currency,
    expected: obligation.expected,
    paid: obligation.paid,
    rest: obligation.rest,
    due: obligation.due,
    label: obligation.label,
  });
  const rows: StatusRowView[] = evaluations
    .filter(
      ({ child, obligation }) =>
        (groupFilter === 'all' || (groupFilter === 'none' ? !child.groupId : child.groupId === groupFilter)) &&
        (segment === 'all' || SEGMENT_BY_LABEL[obligation.label] === segment) &&
        matchesRecordListSearch('children', child, records, normalizedSearch),
    )
    .sort(byLabelThenName)
    .map(toRowView);
  const allRows: StatusRowView[] = [...evaluations].sort(byLabelThenName).map(toRowView);
  const groups = [...records.groups].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  // Neafectate de filtre, la fel ca summary — planul SMS trebuie să acopere exact ce arată bannerul/CTA-urile.
  const notifiableRecipients: SmsRecipientRow[] = evaluations.filter(({ obligation }) =>
    NOTIFIABLE_LABELS.has(obligation.label),
  );
  const overdueRecipients: SmsRecipientRow[] = evaluations.filter(({ obligation }) => obligation.label === 'Restanță');

  return {
    status: 'ready',
    failureMessage: '',
    rows,
    allRows,
    notifiableRecipients,
    overdueRecipients,
    summary,
    missingFeeCount,
    segmentCounts,
    groups,
    asOf: todayStr,
    ...filters,
  };
}
