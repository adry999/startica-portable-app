import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useFeeSetup } from './useFeeSetup';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Fixtură: c1 fără taxă (De completat), c2 cu taxă completă (nu apare la filtrul „missing”), c3 arhivat (exclus).
const fixtureState = {
  children: [
    {
      id: 'c1',
      name: 'Andrei Popescu',
      contractNumber: '10',
      attendanceDate: '2026-01-10',
      groupId: null,
      status: 'Activ',
      statusHistory: [],
      feeHistory: [],
      fee: null,
      archived: false,
    },
    {
      id: 'c2',
      name: 'Maria Ionescu',
      contractNumber: '11',
      attendanceDate: '2026-02-05',
      groupId: 'g1',
      status: 'Activ',
      statusHistory: [],
      feeHistory: [{ from: '2026-02', amount: 1200 }],
      fee: 1200,
      archived: false,
    },
    {
      id: 'c3',
      name: 'Ion Radu',
      contractNumber: '12',
      attendanceDate: '2026-01-01',
      groupId: null,
      status: 'Activ',
      statusHistory: [],
      feeHistory: [],
      fee: null,
      archived: true,
    },
  ],
  payments: [],
  expenses: [],
  groups: [{ id: 'g1', name: 'Fluturași', capacity: 20 }],
  categories: [],
  visits: [],
};

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  return session;
}

describe('useFeeSetup', () => {
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
    const { result } = renderHook(() => useFeeSetup());
    expect(result.current.status).toBe('loading');
  });

  it('filtrul implicit "missing" arată doar copiii fără taxă completată, nearhivați', async () => {
    await loadedSession();
    const { result } = renderHook(() => useFeeSetup());

    expect(result.current.rows.map(row => row.id)).toEqual(['c1']);
    expect(result.current.missingCount).toBe(1);
  });

  it('filtrul "all" arată toți copiii nearhivați', async () => {
    await loadedSession();
    const { result } = renderHook(() => useFeeSetup());

    act(() => result.current.setFilter('all'));
    expect(result.current.rows.map(row => row.id).sort()).toEqual(['c1', 'c2']);
  });

  it('nu are edituri pending inițial, iar completarea unei taxe le declanșează', async () => {
    await loadedSession();
    const { result } = renderHook(() => useFeeSetup());

    expect(result.current.hasPendingEdits).toBe(false);
    act(() => result.current.setFee('c1', '1500'));
    expect(result.current.hasPendingEdits).toBe(true);
  });

  it('golirea câmpului de taxă nu contează ca editare (la fel ca în collect())', async () => {
    await loadedSession();
    const { result } = renderHook(() => useFeeSetup());

    act(() => result.current.setFee('c1', ''));
    expect(result.current.hasPendingEdits).toBe(false);
  });

  it('"Aplică la rândurile afișate" pune taxa și grupa pe toate rândurile vizibile', async () => {
    await loadedSession();
    const { result } = renderHook(() => useFeeSetup());

    act(() => {
      result.current.setBulkAmount('1000');
      result.current.setBulkGroupId('g1');
    });
    act(() => result.current.applyBulkToVisible());

    expect(result.current.rows.find(row => row.id === 'c1')?.fee).toBe('1000');
    expect(result.current.rows.find(row => row.id === 'c1')?.groupId).toBe('g1');
  });

  it('save trimite doar rândurile schimbate la /api/children-setup', async () => {
    await loadedSession();
    const { result } = renderHook(() => useFeeSetup());

    act(() => result.current.setFee('c1', '1500'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string, options: RequestInit) => {
      expect(path).toBe('/api/children-setup');
      const body = JSON.parse(options.body as string);
      expect(body.updates).toEqual([{ id: 'c1', from: '2026-01', fee: 1500 }]);
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    let outcome: { updatedCount: number } | undefined;
    await act(async () => {
      outcome = await result.current.save();
    });
    expect(outcome?.updatedCount).toBe(1);
    expect(result.current.hasPendingEdits).toBe(false);
  });

  it('save fără nicio editare respinge cu eroare', async () => {
    await loadedSession();
    const { result } = renderHook(() => useFeeSetup());

    await expect(result.current.save()).rejects.toThrow('Nu ai completat nicio taxă.');
  });
});
