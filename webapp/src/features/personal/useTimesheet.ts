import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@shared/api/session';
import { timesheetKey } from '@shared/personal/timesheet-rules';
import type { TimesheetCode, TimesheetRow } from '@shared/personal/personal.types';
import { toUserError } from '@shared/api/to-user-error';

export interface TimesheetChange {
  staffId: string;
  date: string;
  code: TimesheetCode | null;
}

export type TimesheetFillMode = 'present' | 'copy-previous-week';

export interface TimesheetData {
  status: 'loading' | 'ready' | 'failed';
  failureMessage: string;
  /** Cheie timesheetKey(staffId, date). */
  rows: ReadonlyMap<string, TimesheetRow>;
  mark: (changes: TimesheetChange[]) => void;
  /** Completare rapidă pe săptămână (§9.2/41b) — o singură cerere, un singur rând de audit,
   * doar celulele goale se schimbă. `staffIds` lipsă = toată filiala (WeekFillBar din antet);
   * dat = un singur angajat („Prezent toată săptămâna” pe rând). Întoarce câte celule au fost scrise. */
  fillWeek: (mode: TimesheetFillMode, weekStart: string, staffIds?: string[]) => Promise<number>;
  saving: boolean;
  saveError: string;
  reload: () => Promise<void>;
}

const DEBOUNCE_MS = 400;

/** Pontajul unei luni (23b), cu salvare optimistă și debounce de 400 ms — pe modelul `useAttendance`. */
export function useTimesheet(month: string | null): TimesheetData {
  const [rows, setRows] = useState<Map<string, TimesheetRow>>(new Map());
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>(month ? 'loading' : 'ready');
  const [failureMessage, setFailureMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const pendingRef = useRef<Map<string, TimesheetChange>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // M11: schimbarea rapidă a lunii poate porni un GET înainte ca precedentul să răspundă — un
  // token de cerere ignoră răspunsul vechi dacă sosește după unul mai nou.
  const requestIdRef = useRef(0);

  async function load() {
    const requestId = ++requestIdRef.current;
    if (!month) {
      setRows(new Map());
      setStatus('ready');
      return;
    }
    setStatus('loading');
    try {
      const response = (await requestJson(`/api/personal/timesheet?month=${month}`)) as { rows: TimesheetRow[] };
      if (requestId !== requestIdRef.current) return;
      setRows(new Map(response.rows.map(row => [timesheetKey(row.staffId, row.date), row])));
      setStatus('ready');
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setFailureMessage(toUserError(error));
      setStatus('failed');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function flush() {
    const changes = Array.from(pendingRef.current.values());
    pendingRef.current = new Map();
    if (changes.length === 0) return;
    setSaving(true);
    try {
      const result = (await requestJson('/api/personal/timesheet', { changes })) as { rows: TimesheetRow[] };
      setRows(previous => {
        const next = new Map(previous);
        for (const change of changes) {
          const key = timesheetKey(change.staffId, change.date);
          if (change.code === null) next.delete(key);
        }
        for (const row of result.rows) next.set(timesheetKey(row.staffId, row.date), row);
        return next;
      });
      setSaveError('');
    } catch (error) {
      setSaveError(toUserError(error));
      await load();
    } finally {
      setSaving(false);
    }
  }

  function mark(changes: TimesheetChange[]) {
    setRows(previous => {
      const next = new Map(previous);
      for (const change of changes) {
        const key = timesheetKey(change.staffId, change.date);
        if (change.code === null) next.delete(key);
        else next.set(key, { id: key, staffId: change.staffId, date: change.date, code: change.code });
      }
      return next;
    });
    for (const change of changes) pendingRef.current.set(timesheetKey(change.staffId, change.date), change);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flush();
    }, DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingRef.current.size > 0) void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fillWeek(mode: TimesheetFillMode, weekStart: string, staffIds?: string[]): Promise<number> {
    const response = (await requestJson('/api/personal/timesheet-fill', { mode, weekStart, staffIds })) as {
      rows: TimesheetRow[];
      filled: number;
    };
    if (response.rows.length > 0) {
      setRows(previous => {
        const next = new Map(previous);
        for (const row of response.rows) next.set(timesheetKey(row.staffId, row.date), row);
        return next;
      });
    }
    return response.filled;
  }

  return { status, failureMessage, rows, mark, fillWeek, saving, saveError, reload: load };
}
