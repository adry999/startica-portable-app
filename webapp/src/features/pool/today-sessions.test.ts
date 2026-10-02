import { describe, expect, it } from 'vitest';
import { buildTodaySessions } from './today-sessions';
import type { WeekDay } from '@shared/pool/usePool';

const coaches = [
  { id: 'C1', name: 'Popescu Ana' },
  { id: 'C2', name: 'Ciobanu Elena' },
];

function booking(id: string, coachId: string) {
  return {
    id,
    childId: `CH-${id}`,
    coachId,
    weekday: 4,
    time: '09:00',
    startDate: '2026-09-01',
    endDate: null,
    archivedAt: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

describe('buildTodaySessions (43b)', () => {
  it('fără ziua încărcată, întoarce lista goală', () => {
    expect(buildTodaySessions(undefined, coaches, 45, 600)).toEqual([]);
  });

  it('un interval fără programări nu devine ședință', () => {
    const day: WeekDay = { date: '2026-10-02', slots: [{ time: '09:00', entries: [] }] };
    expect(buildTodaySessions(day, coaches, 45, 600)).toEqual([]);
  });

  it('un interval cu toate programările anulate nu devine ședință', () => {
    const day: WeekDay = {
      date: '2026-10-02',
      slots: [{ time: '09:00', entries: [{ booking: booking('B1', 'C1'), child: null, state: 'cancelled' }] }],
    };
    expect(buildTodaySessions(day, coaches, 45, 600)).toEqual([]);
  });

  it('grupează antrenorii distincți ai intervalului, fără duplicate', () => {
    const day: WeekDay = {
      date: '2026-10-02',
      slots: [
        {
          time: '09:00',
          entries: [
            { booking: booking('B1', 'C1'), child: null, state: 'unmarked' },
            { booking: booking('B2', 'C1'), child: null, state: 'present' },
            { booking: booking('B3', 'C2'), child: null, state: 'unmarked' },
          ],
        },
      ],
    };
    const [session] = buildTodaySessions(day, coaches, 45, 0);
    expect(session.coachLabel).toBe('Popescu Ana, Ciobanu Elena');
    expect(session.childCount).toBe(3);
    expect(session.unmarkedCount).toBe(2);
  });

  it('antrenor inexistent în listă → „Fără antrenor”', () => {
    const day: WeekDay = {
      date: '2026-10-02',
      slots: [{ time: '09:00', entries: [{ booking: booking('B1', 'C9'), child: null, state: 'unmarked' }] }],
    };
    const [session] = buildTodaySessions(day, coaches, 45, 0);
    expect(session.coachLabel).toBe('Fără antrenor');
  });

  it('ședința al cărei interval conține ora curentă e marcată isCurrent', () => {
    const day: WeekDay = {
      date: '2026-10-02',
      slots: [
        { time: '09:00', entries: [{ booking: booking('B1', 'C1'), child: null, state: 'unmarked' }] },
        { time: '11:00', entries: [{ booking: booking('B2', 'C1'), child: null, state: 'unmarked' }] },
      ],
    };
    // 11:20 — în intervalul [11:00, 11:45), nu în [09:00, 09:45).
    const sessions = buildTodaySessions(day, coaches, 45, 11 * 60 + 20);
    expect(sessions.find(s => s.time === '09:00')?.isCurrent).toBe(false);
    expect(sessions.find(s => s.time === '11:00')?.isCurrent).toBe(true);
  });

  it('exact la ora de început e în curs; chiar după durată, nu mai e', () => {
    const day: WeekDay = {
      date: '2026-10-02',
      slots: [{ time: '10:00', entries: [{ booking: booking('B1', 'C1'), child: null, state: 'unmarked' }] }],
    };
    expect(buildTodaySessions(day, coaches, 30, 10 * 60)[0].isCurrent).toBe(true);
    expect(buildTodaySessions(day, coaches, 30, 10 * 60 + 29)[0].isCurrent).toBe(true);
    expect(buildTodaySessions(day, coaches, 30, 10 * 60 + 30)[0].isCurrent).toBe(false);
  });
});
