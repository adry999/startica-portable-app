import { useAppSession } from '@shared/api/session';
import { usePersistedState } from '@shared/state/usePersistedState';
import { useAttendance } from '@shared/attendance';
import { today } from '@domain/calendar-month.mjs';
import { isWorkingDay } from '#shared/domain/holidays-md.mjs';
import { attendanceKey, monthDates, nextAttendanceStatus, summarizeMonth } from '#features/attendance/index.web.mjs';
import type { AttendanceStatus, DayCellKind } from '#features/attendance/attendance.types.d.mts';
import type { Group, RecordsSnapshot } from '@contracts/record-types.mjs';

export interface MonthRowView {
  id: string;
  name: string;
  cells: { date: string; kind: DayCellKind; reason: string }[];
  presentDays: number;
  workingDays: number;
}

export interface AttendanceMonthData {
  status: 'loading' | 'ready' | 'failed';
  failureMessage: string;
  saveError: string;
  dates: string[];
  dayNumbers: number[];
  offDays: boolean[];
  todayIndex: number;
  rows: MonthRowView[];
  presentPerDay: (number | null)[];
  groups: Group[];
  hasUnassignedChildren: boolean;
  groupId: string;
  setGroupId: (value: string) => void;
  groupName: string;
  cycle: (childId: string, date: string) => AttendanceStatus | null;
  setReason: (childId: string, date: string, reason: string) => void;
}

/** Orchestrarea ecranului Luna (18b): grilă copil × zi pentru o singură grupă, plus acțiunile de marcaj pe celulă. */
export function useAttendanceMonth(month: string): AttendanceMonthData {
  const session = useAppSession();
  const records = session.state.state as RecordsSnapshot;
  const [groupId, setGroupId] = usePersistedState<string>('attendance.group', '');

  const sortedGroups = [...records.groups].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const hasUnassignedChildren = records.children.some(child => !child.archived && child.groupId === null);
  // Grupa implicită e prima după nume; dacă alegerea salvată nu mai există, se recalculează la fel.
  const isValidChoice = groupId === 'none' ? hasUnassignedChildren : sortedGroups.some(group => group.id === groupId);
  const effectiveGroupId = isValidChoice ? groupId : (sortedGroups[0]?.id ?? (hasUnassignedChildren ? 'none' : ''));
  const groupName =
    effectiveGroupId === 'none'
      ? 'Fără grupă'
      : (sortedGroups.find(group => group.id === effectiveGroupId)?.name ?? '');

  const attendance = useAttendance(effectiveGroupId ? { month, groupId: effectiveGroupId } : null);

  const dates = monthDates(month);
  const todayStr = today();
  const groupChildren = records.children.filter(child => {
    if (child.archived) return false;
    const matchesGroup = effectiveGroupId === 'none' ? child.groupId === null : child.groupId === effectiveGroupId;
    if (!matchesGroup) return false;
    const startDate = child.attendanceDate ?? child.contractDate ?? '';
    return startDate <= (dates.at(-1) ?? month);
  });

  const summary = summarizeMonth({ children: groupChildren, month, entries: attendance.entries, todayStr });
  const rowsById = new Map(summary.rows.map(row => [row.childId, row]));
  const rows: MonthRowView[] = [...groupChildren]
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    .map(child => {
      const row = rowsById.get(child.id);
      return {
        id: child.id,
        name: child.name,
        cells: row?.cells ?? [],
        presentDays: row?.presentDays ?? 0,
        workingDays: row?.workingDays ?? 0,
      };
    });

  function cycle(childId: string, date: string): AttendanceStatus | null {
    const current = attendance.entries.get(attendanceKey(childId, date))?.status ?? null;
    const next = nextAttendanceStatus(current);
    attendance.mark([{ childId, date, status: next }]);
    return next;
  }

  function setReason(childId: string, date: string, reason: string) {
    attendance.mark([{ childId, date, status: 'excused', reason }]);
  }

  return {
    status: attendance.status,
    failureMessage: attendance.failureMessage,
    saveError: attendance.saveError,
    dates,
    dayNumbers: dates.map(date => Number(date.slice(8, 10))),
    offDays: dates.map(date => !isWorkingDay(date)),
    todayIndex: dates.indexOf(todayStr),
    rows,
    presentPerDay: summary.presentPerDay,
    groups: sortedGroups,
    hasUnassignedChildren,
    groupId: effectiveGroupId,
    setGroupId,
    groupName,
    cycle,
    setReason,
  };
}
