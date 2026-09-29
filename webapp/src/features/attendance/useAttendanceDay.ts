import { useRef, useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { groupTone, type PillTone } from '@shared/ui';
import { sortByGroupOrder } from '@shared/format/group-order';
import { useAttendance } from '@shared/attendance';
import { STATUS_LABEL } from '@shared/attendance/attendance-labels';
import { initials as initialsOf } from '@shared/format/initials';
import {
  attendanceKey,
  isChildEnrolledOn,
  nextAttendanceStatus,
  summarizeDay,
  changesToMarkUnmarkedPresent,
} from '#features/attendance/index.web.mjs';
import type { AttendanceChange, AttendanceStatus } from '#features/attendance/attendance.types.d.mts';
import type { Child, Group, RecordsSnapshot } from '@contracts/record-types.mjs';

interface PriorValue {
  status: AttendanceStatus | null;
  reason: string;
}

/** O acțiune anulabilă (A3c) — `prev` ține starea de dinainte, per copil, ca „Anulează” să
 * rescrie exact acele valori prin `attendance.mark` (trece prin sync/Istoric, nu ștergere locală). */
interface HistoryEntry {
  id: string;
  label: string;
  time: string;
  bulk: boolean;
  prev: Map<string, PriorValue>;
}

export interface HistoryEntryView {
  id: string;
  label: string;
  time: string;
  bulk: boolean;
}

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
  markGroupPresent: (sectionKey: string) => void;
  markAllUnmarkedPresent: () => void;
  /** Istoricul zilei (A3c) — cel mai recent primul, ca în popover-ul „Modificări azi”. */
  history: HistoryEntryView[];
  canUndo: boolean;
  /** Ultima acțiune (Ctrl+Z sau „↶ Anulează”). */
  undoLast: () => void;
  /** Anulează intrarea `id` și tot ce a venit după ea. */
  undoUntil: (id: string) => void;
  undoAll: () => void;
  /** Textul + „↶ Anulează” pentru toastul de după o acțiune în masă (markGroupPresent/markAllUnmarkedPresent). */
  bulkUndoNotice: { label: string; undo: () => void } | null;
  dismissBulkUndoNotice: () => void;
}

/** Orchestrarea ecranului Ziua (18a): tabel de secțiuni per grupă + acțiuni de marcaj, fără logică de randare. */
export function useAttendanceDay(date: string): AttendanceDayData {
  const session = useAppSession();
  const records = session.state.state as RecordsSnapshot;
  const attendance = useAttendance({ date });
  const [groupFilter, setGroupFilter] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [bulkUndoNotice, setBulkUndoNotice] = useState<{ label: string; undo: () => void } | null>(null);
  // Golește istoricul la schimbarea zilei (A3c) — o intrare „Anulează” nu are sens peste altă zi.
  const dateRef = useRef(date);
  if (dateRef.current !== date) {
    dateRef.current = date;
    if (history.length > 0) setHistory([]);
    if (bulkUndoNotice) setBulkUndoNotice(null);
  }

  const enrolled = records.children.filter(child => isChildEnrolledOn(child, date));
  const enrolledIds = enrolled.map(child => child.id);
  // Regulile din domain (summarizeDay, changesToMarkUnmarkedPresent) așteaptă o hartă cheie=childId
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

  function timeLabel(): string {
    return new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }

  function buildHistoryEntry(label: string, changes: AttendanceChange[], bulk: boolean): HistoryEntry {
    const prev = new Map<string, PriorValue>();
    for (const change of changes) {
      const existing = attendance.entries.get(attendanceKey(change.childId, date));
      prev.set(
        change.childId,
        existing ? { status: existing.status, reason: existing.reason } : { status: null, reason: '' },
      );
    }
    return { id: crypto.randomUUID(), label, time: timeLabel(), bulk, prev };
  }

  // Fiecare acțiune anulabilă își capătă intrarea în istoric ÎNAINTE de a muta starea (A3c) —
  // `attendance.mark` trece prin coada de salvare normală, deci „Anulează” e o mutație obișnuită,
  // vizibilă și în Istoricul din Administrare, nu o ștergere locală.
  function pushHistory(label: string, changes: AttendanceChange[], bulk: boolean): HistoryEntry {
    const entry = buildHistoryEntry(label, changes, bulk);
    setHistory(current => [...current, entry]);
    attendance.mark(changes);
    return entry;
  }

  function applyRestore(entries: HistoryEntry[]) {
    const restore = new Map<string, PriorValue>();
    // Din cel mai vechi spre cel mai nou: prima atingere a unui copil e starea de dinainte de
    // TOATE intrările anulate — o intrare mai nouă care nu l-a atins nu trebuie să-l suprascrie.
    for (const entry of entries)
      for (const [childId, value] of entry.prev) if (!restore.has(childId)) restore.set(childId, value);
    const changes: AttendanceChange[] = [...restore.entries()].map(([childId, value]) => ({
      childId,
      date,
      status: value.status,
      reason: value.reason,
    }));
    attendance.mark(changes);
  }

  function undoLast() {
    if (history.length === 0) return;
    applyRestore([history[history.length - 1]]);
    setHistory(current => current.slice(0, -1));
    setBulkUndoNotice(null);
  }

  function undoUntil(id: string) {
    const index = history.findIndex(entry => entry.id === id);
    if (index === -1) return;
    applyRestore(history.slice(index));
    setHistory(current => current.slice(0, index));
    setBulkUndoNotice(null);
  }

  function undoAll() {
    if (history.length === 0) return;
    applyRestore(history);
    setHistory([]);
    setBulkUndoNotice(null);
  }

  function cycle(childId: string): AttendanceStatus | null {
    const current = attendance.entries.get(attendanceKey(childId, date))?.status ?? null;
    const next = nextAttendanceStatus(current);
    const childName = records.children.find(child => child.id === childId)?.name ?? childId;
    const label = `${childName}: ${STATUS_LABEL[current ?? 'unmarked']} → ${STATUS_LABEL[next ?? 'unmarked']}`;
    pushHistory(label, [{ childId, date, status: next }], false);
    return next;
  }

  function setReason(childId: string, reason: string) {
    const childName = records.children.find(child => child.id === childId)?.name ?? childId;
    pushHistory(`${childName}: motiv „${reason}”`, [{ childId, date, status: 'excused', reason }], false);
  }

  function markGroupPresent(sectionKey: string) {
    const children = bySection.get(sectionKey) ?? [];
    const childIds = children.map(child => child.id);
    const changes = changesToMarkUnmarkedPresent(childIds, entriesByChildId, date);
    if (changes.length === 0) return;
    const groupName =
      sectionKey === 'none'
        ? 'Fără grupă'
        : (records.groups.find(group => group.id === sectionKey)?.name ?? sectionKey);
    const label = `${changes.length} ${changes.length === 1 ? 'copil marcat prezent' : 'copii marcați prezenți'} · grupa ${groupName}`;
    const entry = pushHistory(label, changes, true);
    // Nu prin `undoUntil(entry.id)`: closure-ul de mai jos poate fi apelat mult după acest render
    // (toastul stă până la 6s sau până la un clic), când `history` din closure-ul curent ar fi deja
    // depășit — `applyRestore([entry])` + `setHistory` funcțional nu depind de starea capturată acum.
    setBulkUndoNotice({
      label,
      undo: () => {
        applyRestore([entry]);
        setHistory(current => current.filter(item => item.id !== entry.id));
        setBulkUndoNotice(null);
      },
    });
  }

  function markAllUnmarkedPresent() {
    const changes = changesToMarkUnmarkedPresent(enrolledIds, entriesByChildId, date);
    if (changes.length === 0) return;
    const label = `${changes.length} ${changes.length === 1 ? 'copil marcat prezent' : 'copii marcați prezenți'}`;
    const entry = pushHistory(label, changes, true);
    setBulkUndoNotice({
      label,
      undo: () => {
        applyRestore([entry]);
        setHistory(current => current.filter(item => item.id !== entry.id));
        setBulkUndoNotice(null);
      },
    });
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
    markGroupPresent,
    markAllUnmarkedPresent,
    history: [...history].reverse().map(({ id, label, time, bulk }) => ({ id, label, time, bulk })),
    canUndo: history.length > 0,
    undoLast,
    undoUntil,
    undoAll,
    bulkUndoNotice,
    dismissBulkUndoNotice: () => setBulkUndoNotice(null),
  };
}
