import { useCallback, useEffect, useState } from 'react';
import { requestJson, useAppSession } from '@shared/api/session';
import type { Child } from '@contracts/record-types.mjs';
import type {
  PoolBooking,
  PoolSession,
  PoolSettings,
  PoolSessionStatus,
  CoachPay,
} from '#features/pool/pool.types.d.mts';

export interface WeekEntry {
  booking: PoolBooking;
  child: Child | null;
  state: PoolSessionStatus | 'unmarked' | 'scheduled';
}

export interface WeekSlot {
  time: string;
  entries: WeekEntry[];
}

export interface WeekDay {
  date: string;
  slots: WeekSlot[];
}

export interface WeekStats {
  scheduled: number;
  present: number;
  absent: number;
  excused: number;
}

/**
 * Datele Bazinului (23) folosite atât de `features/pool` (ecranele 22a-22c) cât și de
 * `features/backup` (setările 22d) — trăiesc în `shared/`, nu într-un feature, ca niciunul să
 * nu importe din celălalt (`architecture.test.ts`).
 */

/**
 * Săptămâna Bazinului (22a) — reîncarcă la fiecare marcaj/programare nouă, la schimbarea zilei, și
 * (B-8) la fiecare `records-changed` de pe alt calculator: `reloadRecords()` incrementează
 * `session.state.revision`, exact ce ascultă deja `useSyncStatus` — Prezența nu are încă acest
 * fix (nu exista un precedent de mirat), așa că am legat direct de revizie, ca la orice altă
 * citire care trebuie să rămână la zi cu sincronizarea.
 */
export function usePoolWeek(date: string) {
  const session = useAppSession();
  const [days, setDays] = useState<WeekDay[]>([]);
  const [stats, setStats] = useState<WeekStats>({ scheduled: 0, present: 0, absent: 0, excused: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = (await requestJson(`/api/pool/week?date=${date}`)) as { days: WeekDay[]; stats: WeekStats };
      setDays(result.days);
      setStats(result.stats);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, session.state.revision]);

  async function markSession(bookingId: string, sessionDate: string, status: PoolSessionStatus | null) {
    await requestJson('/api/pool/sessions', { changes: [{ bookingId, date: sessionDate, status }] });
    await load();
  }

  return { days, stats, loading, reload: load, markSession };
}

export interface ChildMonthRow {
  childId: string;
  child: Child | null;
  scheduled: number;
  present: number;
  absent: number;
  excused: number;
  cancelled: number;
  unmarked: number;
  amount: number;
  charged: boolean;
  /** Programările și ședințele copilului pe luna cerută — pentru bonul de 58 mm (Task 11). */
  bookings: PoolBooking[];
  sessions: PoolSession[];
}

export interface CoachMonthRow {
  coachId: string;
  coach: { id: string; name: string } | null;
  sessionsHeld: number;
  childrenPresent: number;
  rate: number;
  mode: CoachPay['mode'];
  amount: number;
}

export interface MonthData {
  children: ChildMonthRow[];
  coaches: CoachMonthRow[];
  closing: { month: string; closedAt: string } | null;
  unmarked: number;
}

/**
 * Luna Bazinului (22c) — situația fiecărui copil și a fiecărui antrenor, plus „Închide luna”.
 * Reîncarcă și la `records-changed` de pe alt calculator (B-8) — vezi comentariul din `usePoolWeek`.
 */
export function usePoolMonth(month: string) {
  const session = useAppSession();
  const [data, setData] = useState<MonthData>({ children: [], coaches: [], closing: null, unmarked: 0 });
  const [loading, setLoading] = useState(true);
  const [closingBusy, setClosingBusy] = useState(false);
  const [closeError, setCloseError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData((await requestJson(`/api/pool/month?month=${month}`)) as MonthData);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, session.state.revision]);

  async function closeMonth(method: string, date: string) {
    setClosingBusy(true);
    setCloseError('');
    try {
      await session.mutate('/api/pool/close-month', { month, method, date });
      await load();
    } catch (error) {
      setCloseError((error as Error).message);
      throw error;
    } finally {
      setClosingBusy(false);
    }
  }

  return { ...data, loading, closingBusy, closeError, reload: load, closeMonth };
}

/** Setările bazinului (22d) — semințele prefil formularul până la primul salvat. */
export function usePoolSettings() {
  const [settings, setSettings] = useState<PoolSettings | null>(null);
  const [seed, setSeed] = useState<PoolSettings | null>(null);
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = (await requestJson('/api/pool/settings')) as {
        settings: PoolSettings | null;
        seed: PoolSettings;
        coaches: { id: string; name: string }[];
      };
      setSettings(result.settings);
      setSeed(result.seed);
      setCoaches(result.coaches);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: PoolSettings) {
    const result = (await requestJson('/api/pool/settings', next)) as { settings: PoolSettings };
    setSettings(result.settings);
    return result.settings;
  }

  return { settings, seed, coaches, loading, save, reload: load };
}

export async function saveBooking(input: {
  childId: string;
  coachId: string;
  weekday: number;
  time: string;
  startDate: string;
  endDate?: string | null;
}) {
  return (await requestJson('/api/pool/bookings', { booking: input })) as { booking: PoolBooking };
}

export async function endBooking(id: string, endDate: string) {
  return (await requestJson('/api/pool/bookings', { id, endDate })) as { booking: PoolBooking };
}
