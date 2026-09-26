import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useBirthdays } from './useBirthdays';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const child = (id: string, name: string, birthDate: string, groupId: string | null = null) => ({
  id,
  name,
  status: 'Activ',
  groupId,
  parent: '',
  phone: '',
  fee: 1500,
  feeHistory: [],
  dueDay: 10,
  birthDate,
  archived: false,
});

const fixtureState = {
  children: [
    child('c1', 'Cujba Ovidiu', '2023-09-11', 'g1'),
    child('c2', 'Ionescu Maria', '2020-09-20', 'g2'),
    child('c3', 'Popescu Ion', '2019-10-05', 'g1'),
  ],
  payments: [],
  expenses: [],
  groups: [
    { id: 'g1', name: 'Mars', capacity: 15 },
    { id: 'g2', name: 'Soare', capacity: 15 },
  ],
  categories: [],
  visits: [],
};

async function loadSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('useBirthdays', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  it('pornește de la initialMonth și arată doar zilele de naștere din luna aceea', async () => {
    await loadSession();
    const { result } = renderHook(() => useBirthdays('2026-09'));
    expect(result.current.status).toBe('ready');
    expect(result.current.month).toBe('2026-09');
    expect(result.current.count).toBe(2);
    expect(result.current.list.map(e => e.childId)).toEqual(['c1', 'c2']);
  });

  it('nextMonth/prevMonth schimbă luna; goToday revine la luna curentă', async () => {
    await loadSession();
    const { result } = renderHook(() => useBirthdays('2026-09'));

    act(() => result.current.nextMonth());
    expect(result.current.month).toBe('2026-10');
    expect(result.current.list.map(e => e.childId)).toEqual(['c3']);

    act(() => result.current.prevMonth());
    act(() => result.current.prevMonth());
    expect(result.current.month).toBe('2026-08');

    act(() => result.current.goToday());
    const todayMonth = new Date().toISOString().slice(0, 7);
    expect(result.current.month).toBe(todayMonth);
  });

  it('filtrul pe grupă restrânge lista și contorul, dar păstrează grupa la schimbarea lunii', async () => {
    await loadSession();
    const { result } = renderHook(() => useBirthdays('2026-09'));

    act(() => result.current.setGroup('g1'));
    expect(result.current.count).toBe(1);
    expect(result.current.list.map(e => e.childId)).toEqual(['c1']);

    act(() => result.current.nextMonth());
    expect(result.current.group).toBe('g1');
    expect(result.current.list.map(e => e.childId)).toEqual(['c3']);
  });

  it('grupele au tonuri stabile, derivate din poziția lor sortată după nume', async () => {
    await loadSession();
    const { result } = renderHook(() => useBirthdays('2026-09'));
    // Sortate după nume: Mars, Soare — index 0 și 1.
    expect(result.current.groups).toEqual([
      { id: 'g1', name: 'Mars', tone: 'orange' },
      { id: 'g2', name: 'Soare', tone: 'mint' },
    ]);
  });
});
