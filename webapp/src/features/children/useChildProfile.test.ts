import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useChildProfile } from './useChildProfile';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

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
      contractNumber: '7',
      notes: 'Alergic la arahide.',
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
      date: '2024-02-05',
      childId: 'c1',
      amount: 1500,
      method: 'Card',
      allocations: [{ month: '2026-08', amount: 1500 }],
      archived: false,
    },
    {
      id: 'p3',
      date: '2024-03-05',
      childId: '',
      amount: 300,
      method: 'Cash',
      allocations: [],
      archived: false,
    },
  ],
  expenses: [],
  groups: [{ id: 'g1', name: 'Fluturași', capacity: 15 }],
  categories: [],
  visits: [],
};

describe('useChildProfile', () => {
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
    const { result } = renderHook(() => useChildProfile('c1', '2026-09'));
    expect(result.current.status).toBe('loading');
  });

  it('întoarce not-found pentru un id necunoscut', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useChildProfile('lipsa', '2026-09'));
    expect(result.current.status).toBe('not-found');
  });

  it('încarcă fișa cu grupă, contract, obligație și doar achitările copilului', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    const { result } = renderHook(() => useChildProfile('c1', '2026-09'));
    expect(result.current.status).toBe('ready');
    expect(result.current.child?.name).toBe('Andrei Popescu');
    expect(result.current.groupName).toBe('Fluturași');
    expect(result.current.contractLabel).toBe('7');
    expect(result.current.obligation?.label).toBe('Plătit');
    expect(result.current.payments).toHaveLength(2);
    expect(result.current.payments.map(p => p.id)).toEqual(['p1', 'p2']);
  });
});
