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
    const item = result.current.attentionItems.find(entry => entry.title === 'Restanțe peste scadență');
    expect(item?.count).toBe(1);
    expect(item?.view).toBe('status');
    expect(item?.params).toEqual({ segment: 'overdue' });
    expect(item?.detail).toMatch(/lei · cea mai veche din ianuarie/);
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
    const missing = result.current.attentionItems.find(entry => entry.title === 'Copii cu date obligatorii lipsă');
    const phone = result.current.attentionItems.find(entry => entry.title === 'Telefoane invalide');
    expect(missing?.count).toBe(1);
    expect(missing?.params).toEqual({ filtru: 'incomplete' });
    expect(phone?.count).toBe(1);
    expect(phone?.detail).toBe('Nu primesc SMS');
    expect(phone?.params).toEqual({ filtru: 'telefon-invalid' });
  });

  it('45c/F24: sistem — fără nicio copie externă de backup, apare „Niciun backup extern încă"', async () => {
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
    const item = result.current.attentionItems.find(entry => entry.title === 'Niciun backup extern încă');
    expect(item).toBeDefined();
    expect(item?.view).toBe('settings');
    expect(item?.count).toBe('!');
  });

  it('F24: sistem — backup vechi de 10 zile arată „Backup-ul extern are 10 zile" + data ultimei copii', async () => {
    const old = new Date(Date.now() - 10 * 86400000).toISOString();
    stubFetch(
      { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] },
      { lastExternal: old },
    );
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useDashboard('2026-09'));
    const item = result.current.attentionItems.find(entry => entry.title === 'Backup-ul extern are 10 zile');
    expect(item).toBeDefined();
    expect(item?.detail).toMatch(/^Ultima copie pe stick: \d{2}\.\d{2}$/);
  });

  it('45c: sistem — o copie externă recentă (sub 7 zile) nu arată niciun item de backup', async () => {
    const recent = new Date(Date.now() - 2 * 86400000).toISOString();
    stubFetch(
      { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] },
      { lastExternal: recent },
    );
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useDashboard('2026-09'));
    expect(result.current.attentionItems.find(entry => entry.view === 'settings')).toBeUndefined();
  });

  // F24 (PROMPT-11 §12.2): marți 2026-09-15, luni 2026-09-14 — ambele zile lucrătoare.
  const PRESENCE_TODAY = '2026-09-15';
  const PRESENCE_YESTERDAY = '2026-09-14';
  const presenceState = {
    children: [
      {
        id: 'c1',
        name: 'Copil Prezent',
        status: 'Activ',
        groupId: 'g1',
        parent: '',
        phone: '',
        fee: 1500,
        feeHistory: [],
        dueDay: 10,
        attendanceDate: '2020-01-01',
        birthDate: '2020-01-01',
        archived: false,
      },
    ],
    payments: [],
    expenses: [],
    groups: [{ id: 'g1', name: 'Venus', capacity: 10 }],
    categories: [],
    visits: [],
  };

  function stubPresenceFetch(entriesByDate: Record<string, unknown[]>) {
    const fetchMock = vi.fn(async (path: string) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
      if (path === '/api/state')
        return jsonResponse({ state: presenceState, revision: 1, updatedAt: '2026-09-15T08:00:00Z' });
      if (path === '/api/health') return jsonResponse({});
      const match = path.match(/^\/api\/attendance\?date=(.+)$/);
      if (match) return jsonResponse({ entries: entriesByDate[match[1]] ?? [] });
      throw new Error(`neașteptat: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  // waitFor nu merge sub fake timers (polling intern pe setTimeout real, rămâne blocat) — avansăm
  // manual ceasul fals, de câteva ori, ca să lase efectul lui useAttendance să pornească și să se rezolve.
  async function waitForAttendanceFetch(fetchMock: ReturnType<typeof vi.fn>) {
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      if (fetchMock.mock.calls.some(([path]) => String(path).startsWith('/api/attendance'))) break;
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  it('F24: dimineața (înainte de ora de închidere), ziua de azi nemarcată nu apare', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${PRESENCE_TODAY}T08:00:00`));
    try {
      // Azi (necontrolat, nu trebuie privit) e gol; ieri e deja marcat complet.
      const fetchMock = stubPresenceFetch({
        [PRESENCE_TODAY]: [],
        [PRESENCE_YESTERDAY]: [{ childId: 'c1', date: PRESENCE_YESTERDAY, status: 'present' }],
      });
      const session = renderHook(() => useAppSession());
      await act(() => session.result.current.load());

      const { result } = renderHook(() => useDashboard('2026-09'));
      await waitForAttendanceFetch(fetchMock);
      expect(result.current.attentionItems.find(entry => entry.view === 'attendance')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('F24: ieri nemarcat la o grupă → „Prezența de ieri nemarcată · Grupa Venus · 1 copil"', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${PRESENCE_TODAY}T08:00:00`));
    try {
      const fetchMock = stubPresenceFetch({ [PRESENCE_TODAY]: [], [PRESENCE_YESTERDAY]: [] });
      const session = renderHook(() => useAppSession());
      await act(() => session.result.current.load());

      const { result } = renderHook(() => useDashboard('2026-09'));
      await waitForAttendanceFetch(fetchMock);
      const item = result.current.attentionItems.find(entry => entry.view === 'attendance');
      expect(item?.title).toBe('Prezența de ieri nemarcată');
      expect(item?.detail).toBe('Grupa Venus · 1 copil');
      expect(item?.count).toBe(1);
      expect(item?.tone).toBe('date');
      expect(item?.params).toEqual({ data: PRESENCE_YESTERDAY, grupa: 'g1' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('F24: după ora de închidere, ziua de azi (dacă lucrătoare) intră în calcul', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${PRESENCE_TODAY}T19:00:00`));
    try {
      const fetchMock = stubPresenceFetch({ [PRESENCE_TODAY]: [], [PRESENCE_YESTERDAY]: [] });
      const session = renderHook(() => useAppSession());
      await act(() => session.result.current.load());

      const { result } = renderHook(() => useDashboard('2026-09'));
      await waitForAttendanceFetch(fetchMock);
      const item = result.current.attentionItems.find(entry => entry.view === 'attendance');
      expect(item?.title).not.toBe('Prezența de ieri nemarcată');
      expect(item?.params).toEqual({ data: PRESENCE_TODAY, grupa: 'g1' });
    } finally {
      vi.useRealTimers();
    }
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
