import { useAppSession } from '@shared/api/session';
import { usePersistedState } from '@shared/state/usePersistedState';
import { useAttendance } from '@shared/attendance';
import { STATUS_LABEL } from '@shared/attendance/attendance-labels';
import { sortByGroupOrder } from '@shared/format/group-order';
import { today } from '@domain/calendar-month.mjs';
import { isWorkingDay } from '#shared/domain/holidays-md.mjs';
import { attendanceKey, monthDates, nextAttendanceStatus, summarizeMonth } from '#features/attendance/index.web.mjs';
import type { AttendanceChange, AttendanceStatus, DayCellKind } from '#features/attendance/attendance.types.d.mts';
import type { Group, RecordsSnapshot } from '@contracts/record-types.mjs';
import { useUndoStack } from '@shared/state/useUndoStack';
import type { HistoryEntryView } from './useAttendanceDay';

/** O acțiune anulabilă (A3e) — ca în Ziua (A3c), dar o intrare ține și data celulei, nu doar
 * copilul, fiindcă aceeași grilă are mai multe zile deodată. */
interface PriorValue {
  childId: string;
  date: string;
  status: AttendanceStatus | null;
  reason: string;
}

function dayMonthLabel(date: string): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

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
  saving: boolean;
  saveError: string;
  savedAt: string;
  unsavedCount: number;
  retry: () => void;
  dates: string[];
  dayNumbers: number[];
  offDays: boolean[];
  todayIndex: number;
  /** Luna vizualizată nu e luna curentă (Audit-B #4) — roster-ul arată grupa de azi, nu una istorică. */
  isHistoricalMonth: boolean;
  rows: MonthRowView[];
  presentPerDay: (number | null)[];
  groups: Group[];
  hasUnassignedChildren: boolean;
  groupId: string;
  setGroupId: (value: string) => void;
  groupName: string;
  cycle: (childId: string, date: string) => AttendanceStatus | null;
  setReason: (childId: string, date: string, reason: string) => void;
  /** Istoricul lunii (A3e) — cel mai recent primul, ca în Ziua. */
  history: HistoryEntryView[];
  canUndo: boolean;
  undoLast: () => void;
  undoUntil: (id: string) => void;
  undoAll: () => void;
}

/** Orchestrarea ecranului Luna (18b): grilă copil × zi pentru o singură grupă, plus acțiunile de marcaj pe celulă. */
export function useAttendanceMonth(month: string): AttendanceMonthData {
  const session = useAppSession();
  const records = session.state.state as RecordsSnapshot;
  const [groupId, setGroupId] = usePersistedState<string>('attendance.group', '');

  const sortedGroups = sortByGroupOrder(records.groups);
  const hasUnassignedChildren = records.children.some(child => !child.archived && child.groupId === null);
  // Grupa implicită e prima după nume; dacă alegerea salvată nu mai există, se recalculează la fel.
  const isValidChoice = groupId === 'none' ? hasUnassignedChildren : sortedGroups.some(group => group.id === groupId);
  const effectiveGroupId = isValidChoice ? groupId : (sortedGroups[0]?.id ?? (hasUnassignedChildren ? 'none' : ''));
  const groupName =
    effectiveGroupId === 'none'
      ? 'Fără grupă'
      : (sortedGroups.find(group => group.id === effectiveGroupId)?.name ?? '');

  const attendance = useAttendance(effectiveGroupId ? { month, groupId: effectiveGroupId } : null);
  // Golește istoricul la schimbarea lunii (A3e) — ca la schimbarea zilei în Ziua.
  const undo = useUndoStack<PriorValue>(month, restore => {
    const changes: AttendanceChange[] = [...restore.values()].map(value => ({
      childId: value.childId,
      date: value.date,
      status: value.status,
      reason: value.reason,
    }));
    attendance.mark(changes);
  });

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

  // Fiecare acțiune anulabilă își capătă intrarea în istoric ÎNAINTE de a muta starea (ca în Ziua,
  // A3c) — `attendance.mark` trece prin coada de salvare normală, deci „Anulează” e o mutație
  // obișnuită, vizibilă și în Istoricul din Administrare, nu o ștergere locală.
  function pushHistory(label: string, childId: string, date: string, change: AttendanceChange) {
    const existing = attendance.entries.get(attendanceKey(childId, date));
    const prev = new Map<string, PriorValue>([
      [
        attendanceKey(childId, date),
        { childId, date, status: existing?.status ?? null, reason: existing?.reason ?? '' },
      ],
    ]);
    undo.push(label, prev);
    attendance.mark([change]);
  }

  function cycle(childId: string, date: string): AttendanceStatus | null {
    const current = attendance.entries.get(attendanceKey(childId, date))?.status ?? null;
    const next = nextAttendanceStatus(current);
    const childName = records.children.find(child => child.id === childId)?.name ?? childId;
    const label = `${childName} ${dayMonthLabel(date)}: ${STATUS_LABEL[current ?? 'unmarked']} → ${STATUS_LABEL[next ?? 'unmarked']}`;
    pushHistory(label, childId, date, { childId, date, status: next });
    return next;
  }

  function setReason(childId: string, date: string, reason: string) {
    const childName = records.children.find(child => child.id === childId)?.name ?? childId;
    const label = `${childName} ${dayMonthLabel(date)}: motiv „${reason}”`;
    pushHistory(label, childId, date, { childId, date, status: 'excused', reason });
  }

  return {
    status: attendance.status,
    failureMessage: attendance.failureMessage,
    saving: attendance.saving,
    saveError: attendance.saveError,
    savedAt: attendance.savedAt,
    unsavedCount: attendance.unsavedCount,
    retry: attendance.retry,
    dates,
    dayNumbers: dates.map(date => Number(date.slice(8, 10))),
    offDays: dates.map(date => !isWorkingDay(date)),
    todayIndex: dates.indexOf(todayStr),
    isHistoricalMonth: month !== todayStr.slice(0, 7),
    rows,
    presentPerDay: summary.presentPerDay,
    groups: sortedGroups,
    hasUnassignedChildren,
    groupId: effectiveGroupId,
    setGroupId,
    groupName,
    cycle,
    setReason,
    history: undo.history,
    canUndo: undo.canUndo,
    undoLast: undo.undoLast,
    undoUntil: undo.undoUntil,
    undoAll: undo.undoAll,
  };
}
