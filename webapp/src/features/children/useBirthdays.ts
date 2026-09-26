import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { groupTone, type PillTone } from '@shared/ui';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { buildBirthdayMonth } from '#features/children/index.web.mjs';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';

export type BirthdaysStatus = 'loading' | 'ready' | 'failed';

export interface BirthdayEntry {
  childId: string;
  name: string;
  firstName: string;
  lastInitial: string;
  turningAge: number;
  groupId: string | null;
}

export interface BirthdayMonthDay {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isCurrentWeek: boolean;
  isPast: boolean;
  isWeekend: boolean;
  entries: BirthdayEntry[];
}

export interface BirthdayListEntry extends BirthdayEntry {
  date: string;
  day: number;
}

export interface BirthdaysGroupOption {
  id: string;
  name: string;
  tone: PillTone;
}

export interface BirthdaysData {
  status: BirthdaysStatus;
  failureMessage: string;
  month: string;
  setMonth: (month: string) => void;
  prevMonth: () => void;
  nextMonth: () => void;
  goToday: () => void;
  group: string;
  setGroup: (group: string) => void;
  weeks: BirthdayMonthDay[][];
  list: BirthdayListEntry[];
  count: number;
  groups: BirthdaysGroupOption[];
}

function shiftMonth(monthKey: string, delta: number): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7)) - 1;
  const d = new Date(year, month + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Ecranul „Zile de naștere" (Copii → Zile de naștere): calendar lunar propriu (nu se sincronizează cu
 * selectorul de lună global), filtrabil pe grupă. Filtrarea se face aici, pe entries și pe list — nu în domeniu. */
export function useBirthdays(initialMonth: string): BirthdaysData {
  const session = useAppSession();
  const todayValue = todayFn();
  const { state, ready, loading, saveError } = session.state;
  const records = state as RecordsSnapshot;

  const [month, setMonth] = useState(initialMonth);
  const [group, setGroup] = useState('all');

  function prevMonth() {
    setMonth(current => shiftMonth(current, -1));
  }

  function nextMonth() {
    setMonth(current => shiftMonth(current, 1));
  }

  function goToday() {
    setMonth(todayValue.slice(0, 7));
  }

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      month,
      setMonth,
      prevMonth,
      nextMonth,
      goToday,
      group,
      setGroup,
      weeks: [],
      list: [],
      count: 0,
      groups: [],
    };
  }

  const groups: BirthdaysGroupOption[] = [...records.groups]
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    .map(g => ({ id: g.id, name: g.name, tone: groupTone(g.id, records.groups) }));

  const { weeks: allWeeks, list: allList } = buildBirthdayMonth(records.children, month, todayValue);
  const matchesGroup = (entry: { groupId: string | null }) => group === 'all' || entry.groupId === group;

  const weeks = allWeeks.map(week => week.map(day => ({ ...day, entries: day.entries.filter(matchesGroup) })));
  const list = allList.filter(matchesGroup);

  return {
    status: 'ready',
    failureMessage: '',
    month,
    setMonth,
    prevMonth,
    nextMonth,
    goToday,
    group,
    setGroup,
    weeks,
    list,
    count: list.length,
    groups,
  };
}
