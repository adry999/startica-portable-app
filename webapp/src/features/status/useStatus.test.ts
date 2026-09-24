import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useStatus } from './useStatus';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Fixtură: un copil activ cu taxă și o achitare parțială, unul arhivat fără
// nicio achitare, unul fără taxă completată (De verificat).
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
      feeHistory: [{ from: '2026-01', amount: 1500 }],
      archived: false,
    },
    {
      id: 'c2',
      name: 'Maria Ionescu',
      contractDate: '2026-01-05',
      attendanceDate: '2026-01-05',
      withdrawalDate: '2026-08-31',
      status: 'Retras',
      statusHistory: [],
      feeHistory: [{ from: '2026-01', amount: 1200 }],
      archived: true,
    },
    {
      id: 'c3',
      name: 'Ion Radu',
      contractDate: '2026-02-01',
      attendanceDate: '2026-02-01',
      withdrawalDate: null,
      status: 'Activ',
      statusHistory: [],
      feeHistory: [],
      archived: false,
    },
  ],
  payments: [
    {
      id: 'p1',
      date: '2026-09-10',
      childId: 'c1',
      amount: 500,
      tenders: [{ method: 'Cash', amount: 500 }],
      allocations: [{ month: '2026-09', amount: 500 }],
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

describe('useStatus', () => {
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('e loading înainte ca sesiunea să fie gata', () => {
    const { result } = renderHook(() => useStatus('2026-09'));
    expect(result.current.status).toBe('loading');
  });

  it('include toți copiii, inclusiv arhivați', async () => {
    await loadedSession();
    const { result } = renderHook(() => useStatus('2026-09'));

    expect(result.current.status).toBe('ready');
    expect(result.current.rows.map(row => row.id).sort()).toEqual(['c1', 'c2', 'c3']);
    expect(result.current.rows.find(row => row.id === 'c2')?.archived).toBe(true);
  });

  it('calculează rest pe baza achitării parțiale', async () => {
    await loadedSession();
    const { result } = renderHook(() => useStatus('2026-09'));

    const row = result.current.rows.find(row => row.id === 'c1');
    expect(row?.expected).toBe(1500);
    expect(row?.paid).toBe(500);
    expect(row?.rest).toBe(1000);
    // scadența e ziua din contract (10); azi e după scadență, deci restanță, nu doar plată parțială.
    expect(row?.label).toBe('Restanță');
  });

  it('copilul retras înainte de lună nu are obligație', async () => {
    await loadedSession();
    const { result } = renderHook(() => useStatus('2026-09'));

    const row = result.current.rows.find(row => row.id === 'c2');
    expect(row?.expected).toBe(0);
    expect(row?.label).toBe('Fără obligație');
  });

  it('copilul fără taxă completată e de verificat', async () => {
    await loadedSession();
    const { result } = renderHook(() => useStatus('2026-09'));

    const row = result.current.rows.find(row => row.id === 'c3');
    expect(row?.expected).toBeNull();
    expect(row?.label).toBe('De verificat');
  });
});
