import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { StatusPage } from './StatusPage';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

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
  ],
  payments: [],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
};

function renderPage() {
  return render(<StatusPage month="2026-09" />);
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('StatusPage', () => {
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
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată un mesaj de încărcare înainte ca sesiunea să fie gata', () => {
    renderPage();
    expect(screen.getByText('Se încarcă datele…')).toBeInTheDocument();
  });

  it('randează tabelul cu obligația fiecărui copil', async () => {
    await loadedSession();
    renderPage();

    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();
    expect(screen.getByText('Restanță')).toBeInTheDocument();
  });

  it('butonul de tipărire declanșează window.print', async () => {
    await loadedSession();
    renderPage();

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    screen.getByText('Tipărește raportul').click();
    expect(printSpy).toHaveBeenCalled();
  });
});
