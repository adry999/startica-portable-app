import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useNotify } from './useNotify';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// c1: restanță (scadență trecută), c2: nescadent încă dar cu rest, c3: arhivat
// (exclus chiar dacă ar avea rest), c4: fără taxă completată (De verificat).
const fixtureState = {
  children: [
    {
      id: 'c1',
      name: 'Andrei Popescu',
      parent: 'Maria Popescu',
      phone: '0722000000',
      contractDate: '2026-01-05',
      attendanceDate: '2026-01-05',
      status: 'Activ',
      statusHistory: [],
      feeHistory: [{ from: '2026-01', amount: 1500 }],
      groupId: null,
      archived: false,
    },
    {
      id: 'c2',
      name: 'Maria Ionescu',
      parent: '',
      phone: '',
      contractDate: '2026-09-30',
      attendanceDate: '2026-01-05',
      status: 'Activ',
      statusHistory: [],
      feeHistory: [{ from: '2026-01', amount: 1200 }],
      groupId: null,
      archived: false,
    },
    {
      id: 'c3',
      name: 'Ion Radu',
      parent: 'Vasile Radu',
      phone: '0733000000',
      contractDate: '2026-01-05',
      attendanceDate: '2026-01-05',
      status: 'Retras',
      statusHistory: [],
      feeHistory: [{ from: '2026-01', amount: 1000 }],
      groupId: null,
      archived: true,
    },
    {
      id: 'c4',
      name: 'Sofia Marin',
      parent: 'Elena Marin',
      phone: '0744000000',
      contractDate: '2026-01-05',
      attendanceDate: '2026-01-05',
      status: 'Activ',
      statusHistory: [],
      feeHistory: [],
      groupId: null,
      archived: false,
    },
  ],
  payments: [],
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

describe('useNotify', () => {
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
    const { result } = renderHook(() => useNotify('2026-09'));
    expect(result.current.status).toBe('loading');
  });

  it('exclude arhivații și copiii fără rest, include restanțierul și pe cel nescadent', async () => {
    await loadedSession();
    const { result } = renderHook(() => useNotify('2026-09'));

    expect(result.current.rows.map(row => row.id)).toEqual(['c1', 'c2']);
  });

  it('sortează implicit după întârzierea cea mai veche', async () => {
    await loadedSession();
    const { result } = renderHook(() => useNotify('2026-09'));

    expect(result.current.rows[0].id).toBe('c1');
    expect(result.current.rows[0].late).toBe(true);
  });

  it('contorizează "Nu pot fi evaluați" peste toate evaluările active, nu doar cele notificate', async () => {
    await loadedSession();
    const { result } = renderHook(() => useNotify('2026-09'));

    expect(result.current.stats.unknown).toBe(1);
  });

  it('contactul complet lipsă arată "Necompletat"', async () => {
    await loadedSession();
    const { result } = renderHook(() => useNotify('2026-09'));

    const c2 = result.current.rows.find(row => row.id === 'c2');
    expect(c2?.contacts).toEqual([{ name: 'Necompletat', phone: '' }]);
  });

  it('mesajul de reamintire include numele copilului și restul de plată', async () => {
    await loadedSession();
    const { result } = renderHook(() => useNotify('2026-09'));

    const c1 = result.current.rows.find(row => row.id === 'c1');
    expect(c1?.message).toContain('Andrei Popescu');
    expect(c1?.message).toContain('Rest de plată');
  });
});
