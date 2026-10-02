import type { WeekDay } from '@shared/pool/usePool';

export interface TodaySession {
  /** HH:MM */
  time: string;
  /** Numele antrenorului (antrenorilor) ședinței; „Fără antrenor” dacă programarea n-are unul valid. */
  coachLabel: string;
  /** Copii programați, fără cei anulați (nu se taxează, nu vin — ca în Săptămâna, 22a). */
  childCount: number;
  unmarkedCount: number;
  /** Ședința al cărei interval [time, time + durată) conține ora curentă (43b: „evidențiată”). */
  isCurrent: boolean;
}

/**
 * 43b — ședințele de azi, din ziua deja încărcată de `usePoolWeek` (nicio cerere nouă către server:
 * reutilizează exact datele Săptămânii, cum cere PROMPT-CLAUDE-CODE-8.md §12). O programare anulată
 * nu mai e un „copil de azi” (la fel ca în Săptămâna); un interval fără niciun copil rămas nu devine rând.
 */
export function buildTodaySessions(
  day: WeekDay | undefined,
  coaches: { id: string; name: string }[],
  durationMin: number,
  nowMinutes: number,
): TodaySession[] {
  if (!day) return [];
  const coachName = (id: string): string | null => coaches.find(coach => coach.id === id)?.name ?? null;

  const sessions: TodaySession[] = [];
  for (const slot of day.slots) {
    const entries = slot.entries.filter(entry => entry.state !== 'cancelled');
    if (entries.length === 0) continue;

    const names = [...new Set(entries.map(entry => coachName(entry.booking.coachId)).filter((n): n is string => !!n))];
    const [hour, minute] = slot.time.split(':').map(Number);
    const startMinutes = hour * 60 + minute;

    sessions.push({
      time: slot.time,
      coachLabel: names.length > 0 ? names.join(', ') : 'Fără antrenor',
      childCount: entries.length,
      unmarkedCount: entries.filter(entry => entry.state === 'unmarked').length,
      isCurrent: nowMinutes >= startMinutes && nowMinutes < startMinutes + durationMin,
    });
  }
  return sessions;
}
