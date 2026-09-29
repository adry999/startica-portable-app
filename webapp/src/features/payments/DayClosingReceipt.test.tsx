import { act, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { DayClosingReceipt } from './DayClosingReceipt';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const state = {
  children: [],
  payments: [
    {
      id: 'p1',
      date: '2026-09-24',
      childId: '',
      sourceName: 'Bivol Ion',
      amount: 9600,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 9600 }],
      allocations: [],
      archived: false,
    },
    {
      id: 'p2',
      date: '2026-09-24',
      childId: '',
      sourceName: 'Coceva Alisa',
      amount: 2000,
      method: 'Card',
      tenders: [{ method: 'Card', amount: 2000 }],
      allocations: [],
      archived: false,
      service: 'bazin',
    },
  ],
  expenses: [
    {
      id: 'e1',
      date: '2026-09-24',
      category: 'Materiale',
      method: 'cash' as const,
      description: 'Cheltuieli cash',
      amount: 1240,
    },
  ],
  groups: [],
  categories: [],
  visits: [],
};

async function loadedSession() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      const isPost = init?.method === 'POST';
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '2.0.0' });
      if (path === '/api/state' && !isPost)
        return jsonResponse({ state, revision: 1, updatedAt: '2026-09-24T10:00:00Z' });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/kindergarten' && !isPost) return jsonResponse({});
      throw new Error(`neașteptat: ${path}`);
    }),
  );
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('DayClosingReceipt', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată totalul pe metodă și suma rămasă în casă pentru ziua din ?zi=', async () => {
    await loadedSession();
    render(
      <MemoryRouter initialEntries={['/achitari/bon-zi?zi=2026-09-24']}>
        <Routes>
          <Route path="/achitari/bon-zi" element={<DayClosingReceipt />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Bivol Ion')).toBeInTheDocument();
    expect(screen.getByText('Cash · 1')).toBeInTheDocument();
    expect(screen.getAllByText('9.600,00 lei').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Cheltuieli cash')).toBeInTheDocument();
    expect(screen.getByText('8.360,00 lei')).toBeInTheDocument();
  });

  it('arată numele serviciului înaintea plătitorului doar pentru achitările care nu sunt Grădiniță (B3)', async () => {
    await loadedSession();
    render(
      <MemoryRouter initialEntries={['/achitari/bon-zi?zi=2026-09-24']}>
        <Routes>
          <Route path="/achitari/bon-zi" element={<DayClosingReceipt />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Bazin')).toBeInTheDocument();
    expect(screen.getByText('Coceva Alisa')).toBeInTheDocument();
    // Grădiniță (implicit) rămâne fără etichetă — doar numele plătitorului.
    expect(screen.getByText('Bivol Ion')).toBeInTheDocument();
    expect(screen.queryByText('Grădiniță')).not.toBeInTheDocument();
  });
});
