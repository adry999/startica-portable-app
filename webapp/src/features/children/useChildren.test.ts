import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useChildren } from './useChildren';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Patru copii, aleși ca să acopere fiecare stare de plată din spec, plus
// grupă/fără grupă/arhivat: toate scadențele sunt calculate relativ la
// asOf = azi (2026-09-23), pentru luna 2026-09.
const fixtureState = {
  children: [
    {
      id: 'c1',
      name: 'Andrei Popescu',
      status: 'Activ',
      groupId: 'g1',
      parent: 'Maria Popescu',
      phone: '0722000001',
      fee: 1500,
      feeHistory: [{ from: '2020-01', amount: 1500 }],
      statusHistory: [],
      dueDay: 10,
      attendanceDate: '2022-09-01',
      birthDate: '2020-09-24',
      archived: false,
    },
    {
      id: 'c2',
      name: 'Maria Ionescu',
      status: 'Activ',
      groupId: null,
      parent: 'Ioana Ionescu',
      phone: '0722000002',
      fee: 2000,
      feeHistory: [{ from: '2020-01', amount: 2000 }],
      statusHistory: [],
      dueDay: 28,
      attendanceDate: '2022-09-01',
      birthDate: '2019-05-10',
      archived: false,
    },
    {
      id: 'c3',
      name: 'Ionuț Marin',
      status: 'Activ',
      groupId: null,
      parent: 'Elena Marin',
      phone: '0722000003',
      fee: 1200,
      feeHistory: [{ from: '2020-01', amount: 1200 }],
      statusHistory: [],
      dueDay: 5,
      attendanceDate: '2022-09-01',
      birthDate: '2018-03-01',
      archived: true,
    },
    {
      id: 'c4',
      name: 'Sofia Stan',
      status: 'Activ',
      groupId: 'g2',
      parent: 'Radu Stan',
      phone: '0722000004',
      fee: 1800,
      feeHistory: [{ from: '2020-01', amount: 1800 }],
      statusHistory: [],
      dueDay: 29,
      attendanceDate: '2022-09-01',
      birthDate: '2021-11-15',
      archived: false,
    },
    {
      id: 'c5',
      name: 'Radu Groza',
      status: 'Activ',
      groupId: 'g1',
      parent: 'Elena Groza',
      phone: '0722000005',
      // Taxă EUR, plătită integral în lei — fără curs (M10), obligation() ar arăta „De verificat".
      feeHistory: [{ from: '2020-01', amount: 40, currency: 'EUR' }],
      statusHistory: [],
      dueDay: 10,
      attendanceDate: '2022-09-01',
      birthDate: '2021-01-01',
      archived: false,
    },
  ],
  payments: [
    {
      id: 'p1',
      date: '2024-01-05',
      childId: 'c1',
      amount: 1500,
      method: 'Cash',
      allocations: [{ month: '2026-09', amount: 1500 }],
      archived: false,
    },
    {
      id: 'p2',
      date: '2024-01-05',
      childId: 'c2',
      amount: 500,
      method: 'Cash',
      allocations: [{ month: '2026-09', amount: 500 }],
      archived: false,
    },
    // 760 lei la 19 lei/EUR = 40 EUR — taxa c5 achitată integral, dacă hook-ul foloseste cursul.
    {
      id: 'p3',
      date: '2026-09-05',
      childId: 'c5',
      amount: 760,
      method: 'Cash',
      allocations: [{ month: '2026-09', amount: 760 }],
      archived: false,
    },
  ],
  expenses: [],
  groups: [
    { id: 'g1', name: 'Fluturași', capacity: 15 },
    { id: 'g2', name: 'Albinuțe', capacity: 12 },
  ],
  categories: [],
  visits: [],
};

describe('useChildren', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates')
          return jsonResponse({ rates: { '2026-09-05': 19 }, sources: { '2026-09-05': 'bnm' } });
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  // useExchangeRates își pornește fetch-ul într-un efect, fără o promisiune expusă de urmărit direct.
  async function flushExchangeRates() {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }

  it('e loading înainte ca sesiunea să fie gata', () => {
    const { result } = renderHook(() => useChildren('2026-09'));
    expect(result.current.status).toBe('loading');
  });

  it('calculează statisticile din antet (activi, grupe ocupate, fișe de verificat)', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useChildren('2026-09'));
    await flushExchangeRates();
    expect(result.current.status).toBe('ready');
    expect(result.current.summary.activeCount).toBe(4);
    expect(result.current.summary.occupiedGroupsCount).toBe(2);
    expect(result.current.summary.incompleteCount).toBe(1); // c2, singurul nearhivat fără grupă
    expect(result.current.activeTotal).toBe(4);
    expect(result.current.archivedTotal).toBe(1);
  });

  it('mapează starea de obligație pe cele patru culori de plată din spec', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useChildren('2026-09'));
    await flushExchangeRates();
    const byId = Object.fromEntries(result.current.rows.map(row => [row.id, row]));

    expect(byId.c1.payment).toEqual({ tone: 'mint', label: 'Achitat' }); // plătit integral
    expect(byId.c2.payment).toEqual({ tone: 'yellow', label: 'Parțial' }); // plată parțială, nescadent încă
    expect(byId.c3.payment).toEqual({ tone: 'pink', label: 'Neachitat' }); // restanță (scadență trecută)
    expect(byId.c4.payment).toEqual({ tone: 'neutral', label: 'Scadent' }); // nescadent, neplătit
  });

  // M10: obligation() trebuie chemată cu `rates`, altfel un copil cu taxă EUR plătit integral în lei
  // apare „De verificat" aici, dar corect în Situația plăților (useStatus, care deja trece rates).
  it('copilul cu taxă EUR plătit integral în lei foloseste cursul, nu „De verificat"', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useChildren('2026-09'));
    await flushExchangeRates();
    const c5 = result.current.rows.find(row => row.id === 'c5');

    expect(c5?.payment).toEqual({ tone: 'mint', label: 'Achitat' });
  });

  it('păstrează copiii arhivați în listă, cu flag-ul propriu', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useChildren('2026-09'));
    expect(result.current.rows).toHaveLength(5);
    expect(result.current.rows.find(row => row.id === 'c3')?.archived).toBe(true);
    expect(result.current.rows.find(row => row.id === 'c1')?.archived).toBe(false);
  });
});
