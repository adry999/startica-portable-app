import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useAssign } from './useAssign';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Fixtură: p1 are „Andrei” în sourceName, potrivire unică de nume cu c1;
// p2 nu are niciun indiciu de nume, deci n-are sugestii cu nameMatch;
// p3 are „Maria” în sourceName, care se potrivește ambiguu cu c2 și c3.
const fixtureState = {
  children: [
    { id: 'c1', name: 'Andrei Popescu', groupId: null, archived: false, feeHistory: [] },
    { id: 'c2', name: 'Maria Ionescu', groupId: null, archived: false, feeHistory: [] },
    { id: 'c3', name: 'Maria Dinescu', groupId: null, archived: false, feeHistory: [] },
  ],
  payments: [
    {
      id: 'p1',
      date: '2026-09-10',
      childId: '',
      sourceName: 'Andrei P.',
      amount: 1500,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 1500 }],
      allocations: [{ month: '2026-09', amount: 1500 }],
      archived: false,
    },
    {
      id: 'p2',
      date: '2026-09-05',
      childId: '',
      sourceName: '',
      amount: 300,
      method: 'Card',
      tenders: [{ method: 'Card', amount: 300 }],
      allocations: [],
      archived: false,
    },
    {
      id: 'p3',
      date: '2026-09-01',
      childId: '',
      sourceName: 'Maria',
      amount: 500,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 500 }],
      allocations: [],
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

describe('useAssign', () => {
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
    const { result } = renderHook(() => useAssign('2026-09'));
    expect(result.current.status).toBe('loading');
  });

  it('arată toate achitările neasociate, cu riscul calculat', async () => {
    await loadedSession();
    const { result } = renderHook(() => useAssign('2026-09'));

    expect(result.current.rows.map(row => row.paymentId)).toEqual(['p1', 'p2', 'p3']);
    expect(result.current.risk.unassigned).toBe(3);
  });

  it('p1 primește o sugestie cu nume potrivit spre c1', async () => {
    await loadedSession();
    const { result } = renderHook(() => useAssign('2026-09'));

    const p1 = result.current.rows.find(row => row.paymentId === 'p1');
    expect(p1?.options.some(option => option.id === 'c1' && option.group === 'Nume potrivit în sursă')).toBe(true);
  });

  it('fillSuggested completează doar rândurile cu potrivire unică de nume', async () => {
    await loadedSession();
    const { result } = renderHook(() => useAssign('2026-09'));

    let filled = 0;
    act(() => {
      filled = result.current.fillSuggested();
    });

    expect(filled).toBe(1);
    expect(result.current.rows.find(row => row.paymentId === 'p1')?.selectedChildId).toBe('c1');
    expect(result.current.rows.find(row => row.paymentId === 'p2')?.selectedChildId).toBe('');
  });

  it('clearSelections golește toate selecțiile', async () => {
    await loadedSession();
    const { result } = renderHook(() => useAssign('2026-09'));

    act(() => result.current.selectChild('p2', 'c2'));
    expect(result.current.selectedCount).toBe(1);
    act(() => result.current.clearSelections());
    expect(result.current.selectedCount).toBe(0);
  });

  it('save trimite selecțiile la /api/payments-assign și le golește', async () => {
    await loadedSession();
    const { result } = renderHook(() => useAssign('2026-09'));

    act(() => result.current.selectChild('p1', 'c1'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string, options: RequestInit) => {
      expect(path).toBe('/api/payments-assign');
      const body = JSON.parse(options.body as string);
      expect(body.assignments).toEqual([{ id: 'p1', childId: 'c1' }]);
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    let outcome: { saved: number } | undefined;
    await act(async () => {
      outcome = await result.current.save();
    });

    expect(outcome?.saved).toBe(1);
    expect(result.current.selectedCount).toBe(0);
  });

  it('save fără nicio selecție respinge cu eroare', async () => {
    await loadedSession();
    const { result } = renderHook(() => useAssign('2026-09'));

    await expect(result.current.save()).rejects.toThrow('Nu ai ales niciun copil.');
  });

  it('un save eșuat păstrează selecțiile utilizatorului', async () => {
    await loadedSession();
    const { result } = renderHook(() => useAssign('2026-09'));

    act(() => result.current.selectChild('p1', 'c1'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string) => {
      expect(path).toBe('/api/payments-assign');
      return { ok: false, status: 500, json: async () => ({ error: 'eroare server' }) };
    });

    await act(async () => {
      await expect(result.current.save()).rejects.toThrow();
    });

    expect(result.current.selectedCount).toBe(1);
    expect(result.current.rows.find(row => row.paymentId === 'p1')?.selectedChildId).toBe('c1');
  });

  it('un al doilea save() pornit înainte ca primul să se termine este respins, fără o a doua cerere', async () => {
    await loadedSession();
    const { result } = renderHook(() => useAssign('2026-09'));

    act(() => result.current.selectChild('p1', 'c1'));

    let resolveFetch!: (value: { ok: boolean; status: number; json: () => Promise<unknown> }) => void;
    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveFetch = resolve;
        }),
    );

    let firstOutcome!: Promise<{ saved: number }>;
    let secondError: Error | undefined;
    await act(async () => {
      firstOutcome = result.current.save();
      try {
        await result.current.save();
      } catch (error) {
        secondError = error as Error;
      }
    });

    expect(secondError?.message).toBe('O salvare este deja în curs.');
    const assignCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([path]) => path === '/api/payments-assign',
    );
    expect(assignCalls).toHaveLength(1);

    resolveFetch(jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' }));
    await act(async () => {
      await firstOutcome;
    });
  });

  it('un nume ambiguu (potrivire la mai mulți copii) nu se completează automat', async () => {
    await loadedSession();
    const { result } = renderHook(() => useAssign('2026-09'));

    const p3 = result.current.rows.find(row => row.paymentId === 'p3');
    expect(
      p3?.options.filter(option => option.group === 'Nume potrivit în sursă').map(option => option.id).sort(),
    ).toEqual(['c2', 'c3']);

    act(() => {
      result.current.fillSuggested();
    });

    expect(result.current.rows.find(row => row.paymentId === 'p3')?.selectedChildId).toBe('');
  });
});
