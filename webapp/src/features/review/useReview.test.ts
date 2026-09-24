import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useReview } from './useReview';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Fixtură: c1 fără grupă (fișă cu observație), p1 fără copil asociat (achitare cu observație).
const fixtureState = {
  children: [
    {
      id: 'c1',
      name: 'Andrei Popescu',
      groupId: null,
      status: 'Activ',
      statusHistory: [],
      feeHistory: [{ from: '2026-01', amount: 1500 }],
      attendanceDate: '2026-01-10',
      archived: false,
    },
  ],
  payments: [
    {
      id: 'p1',
      date: '2026-09-10',
      childId: '',
      sourceName: 'Import CSV',
      amount: 500,
      method: 'Cash',
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

describe('useReview', () => {
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
    const { result } = renderHook(() => useReview());
    expect(result.current.status).toBe('loading');
  });

  it('grupează observațiile pe fișă/achitare, cu categoria corectă', async () => {
    await loadedSession();
    const { result } = renderHook(() => useReview());

    const ids = result.current.rows.map(row => row.id).sort();
    expect(ids).toEqual(['c1', 'p1']);
    expect(result.current.rows.find(row => row.id === 'p1')?.categories).toContain('unassigned');
    expect(result.current.rows.find(row => row.id === 'c1')?.categories).toContain('children');
  });

  it('filtrul "unassigned" arată doar achitările fără copil', async () => {
    await loadedSession();
    const { result } = renderHook(() => useReview());

    act(() => result.current.setFilter('unassigned'));
    expect(result.current.rows.map(row => row.id)).toEqual(['p1']);
  });

  it('căutarea filtrează după nume', async () => {
    await loadedSession();
    const { result } = renderHook(() => useReview());

    act(() => result.current.setSearch('Andrei'));
    expect(result.current.rows.map(row => row.id)).toEqual(['c1']);
  });

  it('resetFilters golește căutarea și filtrul', async () => {
    await loadedSession();
    const { result } = renderHook(() => useReview());

    act(() => {
      result.current.setSearch('Andrei');
      result.current.setFilter('children');
    });
    act(() => result.current.resetFilters());

    expect(result.current.search).toBe('');
    expect(result.current.filter).toBe('all');
  });

  it('confirmReview trimite reviewed:true pentru achitare', async () => {
    await loadedSession();
    const { result } = renderHook(() => useReview());

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string, options: RequestInit) => {
      expect(path).toBe('/api/record');
      const body = JSON.parse(options.body as string);
      expect(body.record.id).toBe('p1');
      expect(body.record.reviewed).toBe(true);
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.confirmReview('p1'));
  });
});
