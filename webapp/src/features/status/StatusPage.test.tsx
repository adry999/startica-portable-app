import { render, renderHook, act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider, TopbarActionsProvider, useTopbarActionsSlot } from '@shared/ui';
import { StatusPage } from './StatusPage';

/** Randează slot-ul de antet ca Topbar-ul real — comutatorul de mod ajunge acolo, nu în pagină. */
function TopbarActionsSlot() {
  return <>{useTopbarActionsSlot()}</>;
}

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
  const onMonthChange = vi.fn();
  const onNavigate = vi.fn();
  const onOpenChild = vi.fn();
  render(
    <ToastProvider>
      <TopbarActionsProvider>
        <TopbarActionsSlot />
        <StatusPage
          month="2026-09"
          onMonthChange={onMonthChange}
          onNavigate={onNavigate}
          onOpenChild={onOpenChild}
        />
      </TopbarActionsProvider>
    </ToastProvider>,
  );
  return { onMonthChange, onNavigate, onOpenChild };
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
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
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
    await userEvent.click(screen.getByRole('button', { name: 'Tipărește' }));
    expect(printSpy).toHaveBeenCalled();
  });

  it('antetul are comutatorul Lună | An școlar și selectorul de lună în modul Lună', async () => {
    await loadedSession();
    renderPage();
    expect(screen.getByRole('radio', { name: 'Lună' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Luna următoare' })).toBeInTheDocument();
  });

  it('An școlar înlocuiește selectorul de lună cu anul școlar, fără un al doilea titlu în conținut', async () => {
    await loadedSession();
    renderPage();
    await userEvent.click(screen.getByRole('radio', { name: 'An școlar' }));
    expect(screen.getByRole('combobox', { name: 'Anul școlar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Luna următoare' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(localStorage.getItem('view.status')).toBe('year');
  });
});
