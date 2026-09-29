import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { useExchangeRates } from '@shared/api/useExchangeRates';
import {
  evaluateChildrenForSchoolYear,
  schoolYearStartOf,
  schoolYearMonths,
  summarizeSchoolYear,
} from '#features/billing/index.web.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { matchesRecordListSearch } from '#shared/ui/record-list-search.mjs';
import { formatMonthLabel } from '#shared/format/date-format.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import type { Currency, RecordsSnapshot } from '@contracts/record-types.mjs';
import type { SmsRecipientRow } from '@shared/sms';
import type { StatusScreenStatus } from './useStatus';

export type HeatCellKind = 'paid' | 'partial' | 'unpaid' | 'upcoming' | 'none';

/** Un rând cu sold > 0, plus luna cea mai veche cu rest neachitat scadent — sursa mesajului SMS pentru acel copil. */
export type YearRecipientRow = SmsRecipientRow & { month: string };

export interface HeatRowView {
  id: string;
  name: string;
  archived: boolean;
  groupId: string | null;
  cells: { month: string; kind: HeatCellKind }[];
  sold: number;
  soldCurrency: Currency;
}

export interface SchoolYearSummaryView {
  overdueChildren: number;
  unrecovered: number;
  collectionRate: number | null;
  partialThisMonth: number;
}

export interface SchoolYearData {
  status: StatusScreenStatus;
  failureMessage: string;
  /** Harta: după căutare, fără copiii complet în afara anului; sortată după sold descrescător, apoi nume. */
  rows: HeatRowView[];
  /** Copiii cu sold > 0, indiferent de căutare — sursa pentru „Notifică" din cardul de restanțe (SMS P2). */
  recipients: YearRecipientRow[];
  /** Cardurile: tot anul, indiferent de căutare. */
  summary: SchoolYearSummaryView;
  months: string[];
  monthLabels: string[];
  /** Luna de azi, dacă e în anul ales — celula cu contur. */
  currentMonth: string | null;
  /** Anii școlari cu date: de la cel mai vechi attendanceDate/contractDate până la anul curent. */
  schoolYearOptions: number[];
  search: string;
  setSearch: (value: string) => void;
}

const EMPTY_SUMMARY: SchoolYearSummaryView = {
  overdueChildren: 0,
  unrecovered: 0,
  collectionRate: null,
  partialThisMonth: 0,
};

/** `startYear === null` = modul An școlar nu e activ: nimic nu se evaluează (nu 12×N obligații degeaba). */
export function useSchoolYearStatus(startYear: number | null): SchoolYearData {
  const session = useAppSession();
  const { rates } = useExchangeRates();
  const { state, ready, loading, saveError } = session.state;
  const todayStr = todayFn();
  const [search, setSearch] = useState('');

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      rows: [],
      recipients: [],
      summary: EMPTY_SUMMARY,
      months: [],
      monthLabels: [],
      currentMonth: null,
      schoolYearOptions: [],
      search,
      setSearch,
    };
  }

  const records = state as RecordsSnapshot;
  const todayMonth = todayStr.slice(0, 7);
  const firstMonth = records.children
    .map(child => (child.attendanceDate ?? child.contractDate ?? '').slice(0, 7))
    .filter(Boolean)
    .sort()[0];
  const firstYear = firstMonth ? schoolYearStartOf(firstMonth) : schoolYearStartOf(todayMonth);
  const lastYear = Math.max(
    schoolYearStartOf(todayMonth),
    ...records.children.map(child =>
      schoolYearStartOf((child.attendanceDate ?? child.contractDate ?? todayStr).slice(0, 7)),
    ),
  );
  const schoolYearOptions = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);

  if (startYear === null) {
    return {
      status: 'ready',
      failureMessage: '',
      rows: [],
      recipients: [],
      summary: EMPTY_SUMMARY,
      months: [],
      monthLabels: [],
      currentMonth: null,
      schoolYearOptions,
      search,
      setSearch,
    };
  }

  const months = schoolYearMonths(startYear);
  const referenceMonth = todayMonth < months[0] ? months[0] : todayMonth > months[11] ? months[11] : todayMonth;
  const yearEvaluations = evaluateChildrenForSchoolYear(records, startYear, todayStr, rates);
  const yearSummary = summarizeSchoolYear(yearEvaluations, todayStr, referenceMonth, rates);
  const normalizedSearch = normalizeSearchText(search);
  const rows: HeatRowView[] = yearSummary.rows
    .filter(row => row.hasObligation && matchesRecordListSearch('children', row.child, records, normalizedSearch))
    .sort((a, b) => b.sold.amount - a.sold.amount || a.child.name.localeCompare(b.child.name, 'ro'))
    .map(row => ({
      id: row.child.id,
      name: row.child.name,
      archived: Boolean(row.child.archived),
      groupId: row.child.groupId ?? null,
      cells: row.cells,
      sold: row.sold.amount,
      soldCurrency: row.sold.currency as Currency,
    }));
  const monthLabels = months.map(month => formatMonthLabel(month).slice(5));
  const currentMonth = months.includes(todayMonth) ? todayMonth : null;
  const summary: SchoolYearSummaryView = {
    overdueChildren: yearSummary.overdueChildren,
    unrecovered: yearSummary.unrecovered,
    collectionRate: yearSummary.collectionRate,
    partialThisMonth: yearSummary.partialThisMonth,
  };
  // Mesajul SMS e per-lună (planSmsBatch); pentru sold acumulat pe mai multe luni luăm luna cea mai
  // veche cu rest scadent neachitat — aceeași condiție ca overdueMonths din status-summary.mjs.
  const recipients: YearRecipientRow[] = yearSummary.rows
    .filter(row => row.sold.amount > 0)
    .flatMap(row => {
      const evaluation = yearEvaluations.find(entry => entry.child.id === row.child.id);
      const overdueMonth = evaluation?.months.find(
        ({ obligation }) =>
          obligation.expected !== null && obligation.rest !== null && obligation.rest > 0 && todayStr > obligation.due,
      );
      return overdueMonth ? [{ child: row.child, obligation: overdueMonth.obligation, month: overdueMonth.month }] : [];
    });

  return {
    status: 'ready',
    failureMessage: '',
    rows,
    recipients,
    summary,
    months,
    monthLabels,
    currentMonth,
    schoolYearOptions,
    search,
    setSearch,
  };
}
