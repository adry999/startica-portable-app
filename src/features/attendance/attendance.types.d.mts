import type { RecordRepository } from '#shared/contracts/persistence.mjs';

export type AttendanceStatus = 'present' | 'absent' | 'excused';

export interface AttendanceEntry {
  childId: string;
  /** YYYY-MM-DD */
  date: string;
  status: AttendanceStatus;
  /** Doar pentru 'excused'; gol altfel. */
  reason: string;
  /** ISO, scris de server. */
  updatedAt: string;
}

/** `status: null` șterge rândul (lipsa rândului = nemarcat). */
export interface AttendanceChange {
  childId: string;
  date: string;
  status: AttendanceStatus | null;
  reason?: string;
}

export interface AttendanceSaveResult {
  ok: true;
  saved: AttendanceEntry[];
  removed: { childId: string; date: string }[];
}

export type DayCellKind = AttendanceStatus | 'unmarked' | 'future' | 'off' | 'none';

export interface AttendanceRoutesDependencies {
  database: import('node:sqlite').DatabaseSync;
  recordRepository: Pick<RecordRepository, 'exists' | 'readSnapshot'>;
  now?: () => Date;
  today?: () => string;
}
