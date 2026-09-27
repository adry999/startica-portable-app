import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useSchoolYearStatus } from './useSchoolYearStatus';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Fixtură: un copil activ din ianuarie 2026, plătit integral pe septembrie
// 2026, și un copil care începe abia în septembrie 2027 (în afara anului 2026–2027).
const fixtureState = {
  children: [
    {
      id: 'c1',
      name: 'Andrei Popescu',
      contractDate: '2026-01-10',
      attendanceDate: '2026-01-10',
      withdrawalDate: null,
      status: 'Activ',
      statusHistory: [],
      feeHistory: [{ from: '2026-01', amount: 1000 }],
      archived: false,
    },
    {
      id: 'c2',
      name: 'Maria Ionescu',
      contractDate: '2027-09-01',
      attendanceDate: '2027-09-01',
      withdrawalDate: null,
      status: 'Activ',
      statusHistory: [],
      feeHistory: [{ from: '2027-09', amount: 1000 }],
      archived: false,
    },
    {
      id: 'c3',
      name: 'Radu Popa',
      contractDate: '2025-09-05',
      attendanceDate: '2025-09-05',
      withdrawalDate: null,
      status: 'Activ',
      statusHistory: [],
      // Fără nicio achitare de la 2025-09: garantat restanță pe septembrie 2026, indiferent de data reală a testului.
      feeHistory: [{ from: '2025-09', amount: 800 }],
      parent: 'Elena Popa',
      phone: '069111222',
      archived: false,
    },
  ],
  payments: [
    {
      id: 'p1',
      date: '2026-09-02',
      childId: 'c1',
      amount: 1000,
      tenders: [{ method: 'Card', amount: 1000 }],
      allocations: [{ month: '2026-09', amount: 1000 }],
      archived: false,
    },
  ],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
};

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  return session;
}

describe('useSchoolYearStatus', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('nu evaluează nimic când modul nu e activ', async () => {
    await loadedSession();
    const { result } = renderHook(() => useSchoolYearStatus(null));
    expect(result.current.status).toBe('ready');
    expect(result.current.rows).toEqual([]);
  });

  it('dă 12 luni din septembrie în august, cu etichete scurte și luna curentă marcată', async () => {
    await loadedSession();
    const { result } = renderHook(() => useSchoolYearStatus(2026));
    expect(result.current.months[0]).toBe('2026-09');
    expect(result.current.months[11]).toBe('2027-08');
    expect(result.current.monthLabels.slice(0, 3)).toEqual(['Sep', 'Oct', 'Noi']);
    expect(result.current.currentMonth).toBe(new Date().toISOString().slice(0, 7));
  });

  it('ascunde copiii complet în afara anului și sortează după sold', async () => {
    await loadedSession();
    const { result } = renderHook(() => useSchoolYearStatus(2026));
    // c3 acumulează restanțe de la 2025-09, deci soldul lui e mai mare decât al lui c1 (plătit pe septembrie).
    expect(result.current.rows.map(row => row.id)).toEqual(['c3', 'c1']);
    expect(result.current.rows.find(row => row.id === 'c1')?.cells[0].kind).toBe('paid');
  });

  it('recipients conține copiii cu sold > 0, cu luna cea mai veche de restanță (sursa „Notifică” din SMS P2)', async () => {
    await loadedSession();
    const { result } = renderHook(() => useSchoolYearStatus(2026));

    const recipient = result.current.recipients.find(entry => entry.child.id === 'c3');
    expect(recipient).toBeDefined();
    expect(recipient?.child.name).toBe('Radu Popa');
    expect(recipient?.month).toBe('2026-09');
    expect(recipient?.obligation.rest).toBeGreaterThan(0);
    expect(result.current.recipients.some(entry => entry.child.id === 'c1')).toBe(false);
  });

  it('opțiunile de an pornesc de la primul contract și ajung la anul curent', async () => {
    await loadedSession();
    const { result } = renderHook(() => useSchoolYearStatus(2026));
    expect(result.current.schoolYearOptions[0]).toBe(2025); // 2026-01 e în anul școlar 2025–2026
    expect(result.current.schoolYearOptions.at(-1)).toBe(2027); // c2 începe în 2027-09
  });

  it('căutarea restrânge harta, nu cardurile', async () => {
    await loadedSession();
    const { result } = renderHook(() => useSchoolYearStatus(2026));
    const overdueChildren = result.current.summary.overdueChildren;

    act(() => result.current.setSearch('nimeni'));
    expect(result.current.rows).toEqual([]);
    expect(result.current.summary.overdueChildren).toBe(overdueChildren);
  });
});
