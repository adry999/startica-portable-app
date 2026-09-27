import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@shared/api/session';
import { attendanceKey } from '#features/attendance/index.web.mjs';
import type { AttendanceEntry, AttendanceChange } from '#features/attendance/attendance.types.d.mts';

export type AttendanceQuery = { date: string } | { month: string; groupId?: string; childId?: string };

export interface AttendanceData {
  status: 'loading' | 'ready' | 'failed';
  failureMessage: string;
  /** Cheie attendanceKey(childId, date). */
  entries: ReadonlyMap<string, AttendanceEntry>;
  /** Aplică imediat în `entries`, trimite un singur POST după 400 ms cu ultima schimbare per copil·zi. */
  mark: (changes: AttendanceChange[]) => void;
  saving: boolean;
  /** Mesajul ultimului POST eșuat; pagina îl arată în toast. Se golește la următorul POST reușit. */
  saveError: string;
  reload: () => Promise<void>;
}

const DEBOUNCE_MS = 400;

function toQueryString(query: AttendanceQuery): string {
  const params = new URLSearchParams();
  if ('date' in query) {
    params.set('date', query.date);
  } else {
    params.set('month', query.month);
    if (query.groupId) params.set('groupId', query.groupId);
    if (query.childId) params.set('childId', query.childId);
  }
  return params.toString();
}

/** Datele de prezență pentru o zi sau o lună, cu salvare optimistă și debounce de 400 ms (spec 19). */
export function useAttendance(query: AttendanceQuery | null): AttendanceData {
  const [entries, setEntries] = useState<Map<string, AttendanceEntry>>(new Map());
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>(query ? 'loading' : 'ready');
  const [failureMessage, setFailureMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Refs, nu state: lotul în așteptare și temporizatorul nu trebuie să redeseneze pagina.
  const pendingRef = useRef<Map<string, AttendanceChange>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    if (!query) {
      setEntries(new Map());
      setStatus('ready');
      return;
    }
    setStatus('loading');
    try {
      const response = (await requestJson(`/api/attendance?${toQueryString(query)}`)) as { entries: AttendanceEntry[] };
      setEntries(new Map(response.entries.map(entry => [attendanceKey(entry.childId, entry.date), entry])));
      setStatus('ready');
    } catch (error) {
      setFailureMessage((error as Error).message);
      setStatus('failed');
    }
  }

  useEffect(() => {
    void load();
    // Cheia efectivă e conținutul cererii, nu identitatea obiectului — vezi JSON.stringify mai jos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);

  async function flush() {
    const changes = Array.from(pendingRef.current.values());
    pendingRef.current = new Map();
    if (changes.length === 0) return;
    setSaving(true);
    try {
      const result = (await requestJson('/api/attendance', { changes })) as {
        saved: AttendanceEntry[];
        removed: { childId: string; date: string }[];
      };
      setEntries(previous => {
        const next = new Map(previous);
        for (const entry of result.saved) next.set(attendanceKey(entry.childId, entry.date), entry);
        for (const removedEntry of result.removed) next.delete(attendanceKey(removedEntry.childId, removedEntry.date));
        return next;
      });
      setSaveError('');
    } catch (error) {
      setSaveError((error as Error).message);
      // Ecranul revine la starea reală a serverului: un lot eșuat poate fi parțial aplicat local.
      await load();
    } finally {
      setSaving(false);
    }
  }

  function mark(changes: AttendanceChange[]) {
    setEntries(previous => {
      const next = new Map(previous);
      for (const change of changes) {
        const key = attendanceKey(change.childId, change.date);
        if (change.status === null) next.delete(key);
        else
          next.set(key, {
            childId: change.childId,
            date: change.date,
            status: change.status,
            reason: change.reason ?? '',
            updatedAt: '',
          });
      }
      return next;
    });
    for (const change of changes) pendingRef.current.set(attendanceKey(change.childId, change.date), change);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flush();
    }, DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // Cererea supraviețuiește demontării — navigarea nu trebuie să piardă un clic recent.
      if (pendingRef.current.size > 0) void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, failureMessage, entries, mark, saving, saveError, reload: load };
}
