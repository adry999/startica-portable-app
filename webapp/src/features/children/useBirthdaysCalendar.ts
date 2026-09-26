import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { buildBirthdayCalendar } from '#features/children/index.web.mjs';
import type { Group, RecordsSnapshot } from '@contracts/record-types.mjs';

export type BirthdaysStatus = 'loading' | 'ready' | 'failed';

export interface BirthdayCalendarDay {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isCurrentWeek: boolean;
  names: { name: string; turningAge: number }[];
}

export interface BirthdayListEntry {
  date: string;
  day: number;
  name: string;
  turningAge: number;
}

export interface BirthdaysData {
  status: BirthdaysStatus;
  failureMessage: string;
  month: string;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToToday: () => void;
  groups: Group[];
  groupFilter: string;
  setGroupFilter: (groupId: string) => void;
  weeks: BirthdayCalendarDay[][];
  monthList: BirthdayListEntry[];
}

function shiftMonth(monthKey: string, delta: number): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7)) - 1;
  const d = new Date(year, month + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Pagina „Zile de naștere" (2a): calendar lunar navigabil, filtrabil pe grupă — deschis din
 * „Vezi calendarul →" de pe cardul compact al Dashboard-ului. */
export function useBirthdaysCalendar(initialMonth?: string): BirthdaysData {
  const session = useAppSession();
  const todayValue = todayFn();
  const { state, ready, loading, saveError } = session.state;
  const records = state as RecordsSnapshot;

  const [month, setMonth] = useState(() => (initialMonth ?? todayValue).slice(0, 7));
  const [groupFilter, setGroupFilter] = useState('');

  function goToPreviousMonth() {
    setMonth(previous => shiftMonth(previous, -1));
  }

  function goToNextMonth() {
    setMonth(previous => shiftMonth(previous, 1));
  }

  function goToToday() {
    setMonth(todayValue.slice(0, 7));
  }

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      month,
      goToPreviousMonth,
      goToNextMonth,
      goToToday,
      groups: [],
      groupFilter,
      setGroupFilter,
      weeks: [],
      monthList: [],
    };
  }

  const groups = [...records.groups].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const filteredChildren = records.children.filter(
    child => !child.archived && child.birthDate && (!groupFilter || child.groupId === groupFilter),
  );

  const weeks = buildBirthdayCalendar(filteredChildren, todayValue, month);
  const monthList: BirthdayListEntry[] = weeks
    .flat()
    .filter(cell => cell.inMonth)
    .flatMap(cell => cell.names.map(entry => ({ date: cell.date, day: cell.day, ...entry })));

  return {
    status: 'ready',
    failureMessage: '',
    month,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    groups,
    groupFilter,
    setGroupFilter,
    weeks,
    monthList,
  };
}
