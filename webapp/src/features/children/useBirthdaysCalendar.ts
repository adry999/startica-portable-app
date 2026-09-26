import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { buildMonthGrid, type MonthGridDay } from '@domain/month-grid.mjs';
import type { Group, RecordsSnapshot } from '@contracts/record-types.mjs';

export type BirthdaysStatus = 'loading' | 'ready' | 'failed';

/** Aceleași 4 tonuri și același hash ca pe Copii (GROUP_BADGE_TONES) — o grupă are aceeași
 * culoare peste tot în aplicație, nu doar în interiorul acestei pagini. */
export type GroupTone = 'orange' | 'mint' | 'yellow' | 'pink';
const GROUP_TONES: GroupTone[] = ['orange', 'mint', 'yellow', 'pink'];

function hashIndex(value: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % length;
}

export function groupTone(groupId: string): GroupTone {
  return GROUP_TONES[hashIndex(groupId, GROUP_TONES.length)];
}

export interface BirthdayEntry {
  childId: string;
  name: string;
  turningAge: number;
  groupName: string;
  tone: GroupTone;
}

export interface BirthdayCalendarDay extends MonthGridDay {
  entries: BirthdayEntry[];
}

export interface BirthdayListEntry extends BirthdayEntry {
  date: string;
  day: number;
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

/** Pagina „Zile de naștere" (2a): calendar lunar navigabil, filtrabil pe grupă — deschisă din
 * „Vezi calendarul →" de pe Dashboard sau din butonul de pe Copii. */
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
  const groupNameOf = (groupId: string | null) => groups.find(group => group.id === groupId)?.name ?? 'Fără grupă';

  const filteredChildren = records.children.filter(
    child => !child.archived && child.birthDate && (!groupFilter || child.groupId === groupFilter),
  );

  // Potrivire după lună+zi din naștere (nu după an) — un copil apare în orice an calendaristic afișezi.
  const byMonthDay = new Map<string, typeof filteredChildren>();
  for (const child of filteredChildren) {
    const key = child.birthDate!.slice(5, 10);
    if (!byMonthDay.has(key)) byMonthDay.set(key, []);
    byMonthDay.get(key)!.push(child);
  }

  const grid = buildMonthGrid(month, todayValue);
  const weeks: BirthdayCalendarDay[][] = grid.map(week =>
    week.map(day => {
      const dayYear = Number(day.date.slice(0, 4));
      const entries = (byMonthDay.get(day.date.slice(5, 10)) ?? []).map(child => ({
        childId: child.id,
        name: child.name,
        turningAge: dayYear - Number(child.birthDate!.slice(0, 4)),
        groupName: groupNameOf(child.groupId),
        tone: groupTone(child.groupId ?? child.id),
      }));
      return { ...day, entries };
    }),
  );

  const monthList: BirthdayListEntry[] = weeks
    .flat()
    .filter(cell => cell.inMonth)
    .flatMap(cell => cell.entries.map(entry => ({ ...entry, date: cell.date, day: cell.day })));

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
