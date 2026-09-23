import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useDashboard } from './useDashboard';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Fixtură minimă, dar validă față de record-schema.mjs: un copil cu ziua de naștere
// mâine (turningAge testabil), o achitare Cash luna curentă, o cheltuială aceeași lună.
const fixtureState = {
  children: [
    {
      id: 'c1',
      name: 'Andrei Popescu',
      status: 'Activ',
      groupId: null,
      parent: '',
      phone: '',
      fee: 1500,
      feeHistory: [],
      dueDay: 10,
      birthDate: '2020-09-24',
      archived: false,
    },
  ],
  payments: [
    {
      id: 'p1',
      date: '2026-09-10',
      childId: 'c1',
      amount: 1500,
      method: 'Cash',
      allocations: [{ month: '2026-09', amount: 1500 }],
      archived: false,
    },
    { id: 'p2', date: '2026-09-11', childId: '', amount: 300, method: 'Card', allocations: [], archived: false },
  ],
  expenses: [{ id: 'e1', date: '2026-09-05', category: 'Materiale', amount: 200, archived: false }],
  groups: [],
  categories: [],
  visits: [],
};

describe('useDashboard', () => {
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

  it('e loading înainte ca sesiunea să fie gata', () => {
    const { result } = renderHook(() => useDashboard('2026-09'));
    expect(result.current.status).toBe('loading');
  });

  it('calculează încasările, cheltuielile și diferența lunii din fixtura reală', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useDashboard('2026-09'));
    expect(result.current.status).toBe('ready');
    expect(result.current.income).toBe(1800); // 1500 + 300
    expect(result.current.expense).toBe(200);
    expect(result.current.net).toBe(1600);
    expect(result.current.byMethod.Cash).toBe(1500);
    expect(result.current.byMethod.Card).toBe(300);
  });

  it('include achitarea neasociată în alerte, dar nu în avans (are childId gol)', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useDashboard('2026-09'));
    const unassignedItem = result.current.attentionItems.find(item => item.title === 'Achitări neasociate');
    expect(unassignedItem?.count).toBe(1);
  });

  it('arată copilul cu ziua de naștere mâine în lista din următoarele 5 zile', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useDashboard('2026-09'));
    expect(result.current.upcomingBirthdays).toHaveLength(1);
    expect(result.current.upcomingBirthdays[0].child.name).toBe('Andrei Popescu');
    expect(result.current.upcomingBirthdays[0].daysUntil).toBe(1);
    expect(result.current.upcomingBirthdays[0].turningAge).toBe(6);
  });

  it('generează 12 luni de istoric, ultima fiind luna cerută', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useDashboard('2026-09'));
    expect(result.current.revenueHistory).toHaveLength(12);
    expect(result.current.revenueHistory.at(-1)?.month).toBe('2026-09');
    expect(result.current.revenueHistory[0].month).toBe('2025-10');
  });
});
