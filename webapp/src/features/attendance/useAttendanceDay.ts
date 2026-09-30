import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { groupTone, type PillTone } from '@shared/ui';
import { sortByGroupOrder } from '@shared/format/group-order';
import { useAttendance } from '@shared/attendance';
import { STATUS_LABEL } from '@shared/attendance/attendance-labels';
import { initials as initialsOf } from '@shared/format/initials';
import { useUndoStack, type UndoHistoryEntry } from '@shared/state/useUndoStack';
import {
  attendanceKey,
  isChildEnrolledOn,
  nextAttendanceStatus,
  summarizeDay,
} from '#features/attendance/index.web.mjs';
import type { AttendanceChange, AttendanceStatus } from '#features/attendance/attendance.types.d.mts';
import type { Child, Group, RecordsSnapshot } from '@contracts/record-types.mjs';

interface PriorValue {
  status: AttendanceStatus | null;
  reason: string;
}

export type HistoryEntryView = UndoHistoryEntry;

export interface DayTileView {
  child: Child;
  status: AttendanceStatus | null;
  reason: string;
  initials: string;
}

export interface DaySectionView {
  key: string;
  name: string;
  tone: PillTone;
  tiles: DayTileView[];
  present: number;
  unmarked: number;
}

export interface AttendanceDayData {
  status: 'loading' | 'ready' | 'failed';
  failureMessage: string;
  saving: boolean;
  saveError: string;
  savedAt: string;
  unsavedCount: number;
  retry: () => void;
  counts: { present: number; absent: number; excused: number; unmarked: number };
  sections: DaySectionView[];
  groups: Group[];
  groupFilter: string;
  setGroupFilter: (value: string) => void;
  cycle: (childId: string) => AttendanceStatus | null;
  setReason: (childId: string, reason: string) => void;
  /** Istoricul zilei (A3c) — cel mai recent primul, ca în popover-ul „Modificări azi”. */
  history: HistoryEntryView[];
  canUndo: boolean;
  /** Ultima acțiune (Ctrl+Z sau „↶ Anulează”). */
  undoLast: () => void;
  /** Anulează intrarea `id` și tot ce a venit după ea. */
  undoUntil: (id: string) => void;
  undoAll: () => void;
}

/** Orchestrarea ecranului Ziua (18a): tabel de secțiuni per grupă + acțiuni de marcaj, fără logică de randare. */
export function useAttendanceDay(date: string): AttendanceDayData {
  const session = useAppSession();
  const records = session.state.state as RecordsSnapshot;
  const attendance = useAttendance({ date });
  const [groupFilter, setGroupFilter] = useState('');
  // Golește istoricul la schimbarea zilei (A3c) — o intrare „Anulează” nu are sens peste altă zi.
  const undo = useUndoStack<PriorValue>(date, restore => {
    const changes: AttendanceChange[] = [...restore.entries()].map(([childId, value]) => ({
      childId,
      date,
      status: value.status,
      reason: value.reason,
    }));
    attendance.mark(changes);
  });

  const enrolled = records.children.filter(child => isChildEnrolledOn(child, date));
  const enrolledIds = enrolled.map(child => child.id);
  // Regulile din domain (summarizeDay) așteaptă o hartă cheie=childId
  // pentru O SINGURĂ zi; hook-ul partajat ține cheia attendanceKey(childId,date) — se re-mapează aici.
  const entriesByChildId = new Map([...attendance.entries.values()].map(entry => [entry.childId, entry]));
  const counts = summarizeDay(enrolledIds, entriesByChildId);

  const bySection = new Map<string, Child[]>();
  for (const child of enrolled) {
    const key = child.groupId ?? 'none';
    const list = bySection.get(key) ?? [];
    list.push(child);
    bySection.set(key, list);
  }

  // Aceeași ordine peste tot (03-grupe.md §3b): grupele din Tablă/Carduri determină ordinea aici.
  const sectionKeys = sortByGroupOrder(records.groups)
    .map(group => group.id)
    .filter(id => bySection.has(id));
  if (bySection.has('none')) sectionKeys.push('none');

  const filteredKeys = groupFilter ? sectionKeys.filter(key => key === groupFilter) : sectionKeys;

  const sections: DaySectionView[] = filteredKeys.map(key => {
    const children = [...(bySection.get(key) ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
    const tiles = children.map(child => {
      const entry = attendance.entries.get(attendanceKey(child.id, date));
      return { child, status: entry?.status ?? null, reason: entry?.reason ?? '', initials: initialsOf(child.name) };
    });
    const childIds = children.map(child => child.id);
    const sectionCounts = summarizeDay(childIds, entriesByChildId);
    return {
      key,
      name: key === 'none' ? 'Fără grupă' : (records.groups.find(group => group.id === key)?.name ?? key),
      tone: groupTone(key === 'none' ? null : key, records.groups),
      tiles,
      present: sectionCounts.present,
      unmarked: sectionCounts.unmarked,
    };
  });

  // Fiecare acțiune anulabilă își capătă intrarea în istoric ÎNAINTE de a muta starea (A3c) —
  // `attendance.mark` trece prin coada de salvare normală, deci „Anulează” e o mutație obișnuită,
  // vizibilă și în Istoricul din Administrare, nu o ștergere locală.
  function pushHistory(label: string, childId: string, change: AttendanceChange) {
    const existing = attendance.entries.get(attendanceKey(childId, date));
    const prev = new Map<string, PriorValue>([
      [childId, existing ? { status: existing.status, reason: existing.reason } : { status: null, reason: '' }],
    ]);
    undo.push(label, prev);
    attendance.mark([change]);
  }

  function cycle(childId: string): AttendanceStatus | null {
    const current = attendance.entries.get(attendanceKey(childId, date))?.status ?? null;
    const next = nextAttendanceStatus(current);
    const childName = records.children.find(child => child.id === childId)?.name ?? childId;
    const label = `${childName}: ${STATUS_LABEL[current ?? 'unmarked']} → ${STATUS_LABEL[next ?? 'unmarked']}`;
    pushHistory(label, childId, { childId, date, status: next });
    return next;
  }

  function setReason(childId: string, reason: string) {
    const childName = records.children.find(child => child.id === childId)?.name ?? childId;
    pushHistory(`${childName}: motiv „${reason}”`, childId, { childId, date, status: 'excused', reason });
  }

  return {
    status: attendance.status,
    failureMessage: attendance.failureMessage,
    saving: attendance.saving,
    saveError: attendance.saveError,
    savedAt: attendance.savedAt,
    unsavedCount: attendance.unsavedCount,
    retry: attendance.retry,
    counts,
    sections,
    groups: sortByGroupOrder(records.groups),
    groupFilter,
    setGroupFilter,
    cycle,
    setReason,
    history: undo.history,
    canUndo: undo.canUndo,
    undoLast: undo.undoLast,
    undoUntil: undo.undoUntil,
    undoAll: undo.undoAll,
  };
}
