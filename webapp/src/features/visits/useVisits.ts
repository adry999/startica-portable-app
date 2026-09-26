import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { buildMonthGrid, type MonthGridDay } from '#shared/domain/month-grid.mjs';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { matchesRecordListSearch } from '#shared/ui/record-list-search.mjs';
import { summarizeVisitFunnel } from '#features/visits/domain/visit-statistics.mjs';
import { allowedNextStatuses, applyVisitStatus } from '#features/visits/domain/visit-status.mjs';
import { buildChildPrefill } from '#features/visits/domain/visit-child-prefill.mjs';
import { buildVisitRecord, type VisitFormValues } from './visit-form';
import type { Group, RecordsSnapshot, Visit, VisitStatus } from '@contracts/record-types.mjs';

export type VisitsStatus = 'loading' | 'ready' | 'failed';

export interface VisitCalendarDay extends MonthGridDay {
  visits: Visit[];
}

export interface VisitsData {
  status: VisitsStatus;
  failureMessage: string;
  records: RecordsSnapshot;
  groups: Group[];
  month: string;
  setMonth: (month: string) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToToday: () => void;
  weeks: VisitCalendarDay[][];
  selectedDate: string | null;
  setSelectedDate: (date: string | null) => void;
  search: string;
  setSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  allMonths: boolean;
  setAllMonths: (value: boolean) => void;
  showArchived: boolean;
  setShowArchived: (value: boolean) => void;
  funnel: { scheduled: number; done: number; enrolled: number; withdrew: number };
  rows: Visit[];
  allowedNextStatuses: (status: VisitStatus) => VisitStatus[];
  createVisit: (values: VisitFormValues) => Promise<void>;
  updateVisit: (previous: Visit, values: VisitFormValues) => Promise<void>;
  applyQuickStatus: (visit: Visit, status: VisitStatus) => Promise<void>;
  setArchived: (visit: Visit, archived: boolean) => Promise<void>;
  deleteForever: (id: string) => Promise<void>;
  enrollChild: (visit: Visit, overrides: { fee: string; groupId: string; attendanceDate: string }) => Promise<string>;
}

function shiftMonth(monthKey: string, delta: number): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7)) - 1;
  const d = new Date(year, month + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Echivalentul visits.controller.mjs pentru React: calendar + pâlnie + listă filtrată, plus mutațiile de orchestrare. */
export function useVisits(initialDate?: string): VisitsData {
  const session = useAppSession();
  const todayValue = todayFn();
  const { state, ready, loading, saveError } = session.state;
  const records = state as RecordsSnapshot;

  const [month, setMonth] = useState(() => (initialDate ?? todayValue).slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate ?? null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [allMonths, setAllMonths] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  function goToPreviousMonth() {
    setMonth(previous => shiftMonth(previous, -1));
    setSelectedDate(null);
  }

  function goToNextMonth() {
    setMonth(previous => shiftMonth(previous, 1));
    setSelectedDate(null);
  }

  function goToToday() {
    setMonth(todayValue.slice(0, 7));
    setSelectedDate(null);
  }

  async function createVisit(values: VisitFormValues) {
    const record = buildVisitRecord(null, `VIZ-${crypto.randomUUID()}`, values);
    await session.mutate('/api/record', { type: 'visits', mode: 'create', record });
  }

  async function updateVisit(previous: Visit, values: VisitFormValues) {
    const record = buildVisitRecord(previous, previous.id, values);
    await session.mutate('/api/record', { type: 'visits', mode: 'update', record });
  }

  async function applyQuickStatus(visit: Visit, status: VisitStatus) {
    const record = applyVisitStatus(visit, status, new Date().toISOString());
    await session.mutate('/api/record', { type: 'visits', mode: 'update', record });
  }

  async function setArchived(visit: Visit, archived: boolean) {
    await session.mutate('/api/record', {
      type: 'visits',
      mode: 'update',
      record: { ...visit, archived, archivedAt: archived ? new Date().toISOString() : null },
    });
  }

  async function deleteForever(id: string) {
    await session.mutate('/api/record-delete', { type: 'visits', id });
  }

  async function enrollChild(
    visit: Visit,
    overrides: { fee: string; groupId: string; attendanceDate: string },
  ): Promise<string> {
    const prefill = buildChildPrefill(visit);
    const child = {
      ...prefill,
      id: `ID-${crypto.randomUUID()}`,
      status: 'Activ',
      groupId: overrides.groupId || null,
      attendanceDate: overrides.attendanceDate,
      fee: overrides.fee === '' ? null : Number(overrides.fee),
      feeHistory:
        overrides.fee === ''
          ? []
          : [{ from: (overrides.attendanceDate || todayValue).slice(0, 7), amount: Number(overrides.fee) }],
      statusHistory: [{ from: (overrides.attendanceDate || todayValue).slice(0, 7), status: 'Activ' }],
      dueDay: 10,
      archived: false,
    };
    const result = await session.mutate('/api/visits-enrol', { visitId: visit.id, child });
    return result.childId;
  }

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      records,
      groups: [],
      month,
      setMonth,
      goToPreviousMonth,
      goToNextMonth,
      goToToday,
      weeks: [],
      selectedDate,
      setSelectedDate,
      search,
      setSearch,
      statusFilter,
      setStatusFilter,
      allMonths,
      setAllMonths,
      showArchived,
      setShowArchived,
      funnel: { scheduled: 0, done: 0, enrolled: 0, withdrew: 0 },
      rows: [],
      allowedNextStatuses,
      createVisit,
      updateVisit,
      applyQuickStatus,
      setArchived,
      deleteForever,
      enrollChild,
    };
  }

  const todayStr = todayValue;
  const funnel = summarizeVisitFunnel(records.visits, todayStr);

  const visitsByDate = new Map<string, Visit[]>();
  for (const visit of records.visits) {
    if (visit.archived) continue;
    const list = visitsByDate.get(visit.date) ?? [];
    list.push(visit);
    visitsByDate.set(visit.date, list);
  }
  for (const list of visitsByDate.values()) list.sort((a, b) => a.time.localeCompare(b.time));

  const weeks: VisitCalendarDay[][] = buildMonthGrid(month, todayStr).map(week =>
    week.map(day => ({ ...day, visits: visitsByDate.get(day.date) ?? [] })),
  );

  const normalizedSearch = normalizeSearchText(search);
  const rows = records.visits
    .filter(visit => (showArchived ? true : !visit.archived))
    .filter(visit => !statusFilter || visit.status === statusFilter)
    .filter(visit => allMonths || visit.date.slice(0, 7) === month)
    .filter(visit => !selectedDate || visit.date === selectedDate)
    .filter(visit => matchesRecordListSearch('visits', visit, records, normalizedSearch))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  return {
    status: 'ready',
    failureMessage: '',
    records,
    groups: records.groups,
    month,
    setMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    weeks,
    selectedDate,
    setSelectedDate,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    allMonths,
    setAllMonths,
    showArchived,
    setShowArchived,
    funnel,
    rows,
    allowedNextStatuses,
    createVisit,
    updateVisit,
    applyQuickStatus,
    setArchived,
    deleteForever,
    enrollChild,
  };
}
