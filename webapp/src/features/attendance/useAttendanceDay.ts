import { useState } from 'react';
import { useAppSession } from '@shared/api/session';
import { groupTone, type PillTone } from '@shared/ui';
import { useAttendance } from '@shared/attendance';
import { initials as initialsOf } from '@shared/format/initials';
import {
  attendanceKey,
  isChildEnrolledOn,
  nextAttendanceStatus,
  summarizeDay,
  changesToMarkUnmarkedPresent,
} from '#features/attendance/index.web.mjs';
import type { AttendanceStatus } from '#features/attendance/attendance.types.d.mts';
import type { Child, Group, RecordsSnapshot } from '@contracts/record-types.mjs';

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
  saveError: string;
  counts: { present: number; absent: number; excused: number; unmarked: number };
  sections: DaySectionView[];
  groups: Group[];
  groupFilter: string;
  setGroupFilter: (value: string) => void;
  cycle: (childId: string) => AttendanceStatus | null;
  setReason: (childId: string, reason: string) => void;
  markGroupPresent: (sectionKey: string) => void;
  markAllUnmarkedPresent: () => void;
}

/** Orchestrarea ecranului Ziua (18a): tabel de secțiuni per grupă + acțiuni de marcaj, fără logică de randare. */
export function useAttendanceDay(date: string): AttendanceDayData {
  const session = useAppSession();
  const records = session.state.state as RecordsSnapshot;
  const attendance = useAttendance({ date });
  const [groupFilter, setGroupFilter] = useState('');

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

  const sectionKeys = [...bySection.keys()]
    .filter(key => key !== 'none')
    .sort((a, b) => {
      const groupA = records.groups.find(group => group.id === a)?.name ?? '';
      const groupB = records.groups.find(group => group.id === b)?.name ?? '';
      return groupA.localeCompare(groupB, 'ro');
    });
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

  function cycle(childId: string): AttendanceStatus | null {
    const current = attendance.entries.get(attendanceKey(childId, date))?.status ?? null;
    const next = nextAttendanceStatus(current);
    attendance.mark([{ childId, date, status: next }]);
    return next;
  }

  function setReason(childId: string, reason: string) {
    attendance.mark([{ childId, date, status: 'excused', reason }]);
  }

  function markGroupPresent(sectionKey: string) {
    const children = bySection.get(sectionKey) ?? [];
    attendance.mark(children.map(child => ({ childId: child.id, date, status: 'present' })));
  }

  function markAllUnmarkedPresent() {
    attendance.mark(changesToMarkUnmarkedPresent(enrolledIds, entriesByChildId, date));
  }

  return {
    status: attendance.status,
    failureMessage: attendance.failureMessage,
    saveError: attendance.saveError,
    counts,
    sections,
    groups: records.groups,
    groupFilter,
    setGroupFilter,
    cycle,
    setReason,
    markGroupPresent,
    markAllUnmarkedPresent,
  };
}
