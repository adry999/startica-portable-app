import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useDashboard } from './useDashboard';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Fixtură minimă, dar validă față de record-schema.mjs: un copil cu ziua de naștere
// mâine (turningAge testabil), o achitare Cash luna curentă, o cheltuială aceeași lună.
// Data nașterii e relativă la „azi" real, nu fixă — fixă devine flaky pe măsură ce trece timpul.
const BIRTH_YEAR = 2020;
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const BIRTHDAY_TOMORROW = `${BIRTH_YEAR}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
const EXPECTED_TURNING_AGE = tomorrow.getFullYear() - BIRTH_YEAR;

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
      birthDate: BIRTHDAY_TOMORROW,
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

function stubFetch(state: unknown = fixtureState, health: unknown = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
      if (path === '/api/state') return jsonResponse({ state, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
      if (path === '/api/health') return jsonResponse(health);
      // 45c: useDashboard cere prezența zilei lucrătoare curente/trecute pentru „Prezență nemarcată".
      if (path.startsWith('/api/attendance?date=')) return jsonResponse({ entries: [] });
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

describe('useDashboard', () => {
  beforeEach(() => {
    stubFetch();
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

  it('45c: fără probleme, „Necesită atenție" e gol (allClear)', async () => {
    stubFetch(
      {
        children: [
          {
            id: 'c1',
            name: 'Complet Ionescu',
            status: 'Activ',
            groupId: 'g1',
            parent: 'Un părinte',
            phone: '069000009',
            parent2: 'Alt părinte',
            idnp: '2001234567890',
            pickupPersons: [{ id: 'P1', name: 'Bunica' }],
            fee: 1500,
            feeHistory: [{ from: '2020-01', amount: 1500 }],
            statusHistory: [],
            dueDay: 10,
            // Neînscris încă azi (viitor) — exclus din „prezență nemarcată", ca testul ăsta să
            // izoleze „allClear" de sursa de prezență (acoperită separat mai jos).
            attendanceDate: '2099-01-01',
            birthDate: '2020-01-01',
            archived: false,
          },
        ],
        // Plată completă pentru luna curentă — fără ea, copilul ar fi „Restanță" (alt test acoperă asta).
        payments: [
          {
            id: 'p1',
            date: '2026-09-01',
            childId: 'c1',
            amount: 1500,
            method: 'Cash',
            allocations: [{ month: '2026-09', amount: 1500 }],
            archived: false,
          },
        ],
        expenses: [],
        groups: [{ id: 'g1', name: 'Mars', capacity: 10 }],
        categories: [],
        visits: [],
      },
      { lastExternal: new Date().toISOString() },
    );
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useDashboard('2026-09'));
    expect(result.current.attentionItems).toEqual([]);
    expect(result.current.allClear).toBe(true);
  });

  it('45c: bani — restanțele (Situația) intră în „Necesită atenție" cu deep-link spre segmentul overdue', async () => {
    stubFetch({
      children: [
        {
          id: 'c1',
          name: 'Restanțier',
          status: 'Activ',
          groupId: null,
          parent: 'Un părinte',
          phone: '069000009',
          fee: 1500,
          feeHistory: [{ from: '2020-01', amount: 1500 }],
          statusHistory: [],
          dueDay: 1,
          attendanceDate: '2020-01-01',
          archived: false,
        },
      ],
      payments: [],
      expenses: [],
      groups: [],
      categories: [],
      visits: [],
    });
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useDashboard('2026-09'));
    const item = result.current.attentionItems.find(entry => entry.title === 'Restanțe');
    expect(item?.count).toBe(1);
    expect(item?.view).toBe('status');
    expect(item?.params).toEqual({ segment: 'overdue' });
  });

  it('45c: date — fișe incomplete și telefon invalid intră separat, cu deep-link spre Copii', async () => {
    stubFetch({
      children: [
        {
          id: 'c1',
          name: 'Fișă Incompletă',
          status: 'Activ',
          groupId: null,
          parent: '',
          phone: '',
          archived: false,
        },
        {
          id: 'c2',
          name: 'Telefon Rău',
          status: 'Activ',
          groupId: 'g1',
          parent: 'Un părinte',
          phone: '12345',
          phoneInvalid: true,
          // Altfel complet — altfel ar intra și la „Date incomplete" (nu doar la „Telefon invalid").
          parent2: 'Alt părinte',
          idnp: '2001234567891',
          pickupPersons: [{ id: 'P1', name: 'Bunica' }],
          fee: 1000,
          feeHistory: [{ from: '2020-01', amount: 1000 }],
          dueDay: 10,
          birthDate: '2020-01-01',
          archived: false,
        },
      ],
      payments: [],
      expenses: [],
      groups: [{ id: 'g1', name: 'Mars', capacity: 10 }],
      categories: [],
      visits: [],
    });
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useDashboard('2026-09'));
    const missing = result.current.attentionItems.find(entry => entry.title === 'Date incomplete');
    const phone = result.current.attentionItems.find(entry => entry.title === 'Telefon invalid');
    expect(missing?.count).toBe(1);
    expect(missing?.params).toEqual({ filtru: 'incomplete' });
    expect(phone?.count).toBe(1);
    expect(phone?.params).toEqual({ filtru: 'telefon-invalid' });
  });

  it('45c: sistem — fără nicio copie externă de backup, apare „Backup extern vechi"', async () => {
    stubFetch(
      {
        children: [],
        payments: [],
        expenses: [],
        groups: [],
        categories: [],
        visits: [],
      },
      {},
    );
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useDashboard('2026-09'));
    const item = result.current.attentionItems.find(entry => entry.title === 'Backup extern vechi');
    expect(item).toBeDefined();
    expect(item?.view).toBe('settings');
  });

  it('45c: sistem — o copie externă recentă (sub 7 zile) nu arată „Backup extern vechi"', async () => {
    const recent = new Date(Date.now() - 2 * 86400000).toISOString();
    stubFetch(
      { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] },
      { lastExternal: recent },
    );
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useDashboard('2026-09'));
    expect(result.current.attentionItems.find(entry => entry.title === 'Backup extern vechi')).toBeUndefined();
  });

  it('arată copilul cu ziua de naștere mâine în lista din următoarele 5 zile', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useDashboard('2026-09'));
    expect(result.current.upcomingBirthdays).toHaveLength(1);
    expect(result.current.upcomingBirthdays[0].child.name).toBe('Andrei Popescu');
    expect(result.current.upcomingBirthdays[0].daysUntil).toBe(1);
    expect(result.current.upcomingBirthdays[0].turningAge).toBe(EXPECTED_TURNING_AGE);
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
