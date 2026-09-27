import { render, renderHook, act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider, TopbarActionsProvider, useTopbarActionsSlot } from '@shared/ui';
import { ReportPage } from './ReportPage';

function TopbarActionsSlot() {
  return <>{useTopbarActionsSlot()}</>;
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [{ id: 'c1', name: 'Andrei Popescu', groupId: null, status: 'Activ', statusHistory: [], feeHistory: [] }],
  payments: [
    {
      id: 'p1',
      date: '2026-08-03',
      childId: 'c1',
      amount: 1000,
      tenders: [{ method: 'Cash', amount: 1000 }],
      allocations: [{ month: '2026-08', amount: 1000 }],
      archived: false,
    },
    {
      id: 'p2',
      date: '2026-08-10',
      childId: '',
      sourceName: 'Ion Rusu',
      amount: 500,
      tenders: [{ method: 'Card', amount: 500 }],
      allocations: [],
      archived: false,
    },
    {
      id: 'p3',
      date: '2026-08-12',
      childId: 'c1',
      amount: 800,
      tenders: [{ method: 'Transfer', amount: 800 }],
      allocations: [{ month: '2026-09', amount: 800 }],
      fxRate: 19.74,
      fxRateSource: 'bnm',
      amountEur: 40.53,
      archived: false,
    },
  ],
  expenses: [
    {
      id: 'e1',
      date: '2026-08-06',
      category: 'Salarii educatoare',
      description: 'Salariu',
      amount: 400,
      archived: false,
    },
  ],
  groups: [],
  categories: [],
  visits: [],
};

function renderPage() {
  const onMonthChange = vi.fn();
  const onOpenPayments = vi.fn();
  const onOpenAssign = vi.fn();
  render(
    <ToastProvider>
      <TopbarActionsProvider>
        <TopbarActionsSlot />
        <ReportPage
          month="2026-08"
          onMonthChange={onMonthChange}
          onOpenPayments={onOpenPayments}
          onOpenAssign={onOpenAssign}
        />
      </TopbarActionsProvider>
    </ToastProvider>,
  );
  return { onMonthChange, onOpenPayments, onOpenAssign };
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('ReportPage', () => {
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

  it('antetul are comutatorul Lună | Trimestru | An și butonul de export', async () => {
    await loadedSession();
    renderPage();

    expect(screen.getByRole('radio', { name: 'Lună' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Trimestru' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'An' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportă pentru contabil' })).toBeInTheDocument();
  });

  it('cardurile arată încasările, cheltuielile și soldul lunii', async () => {
    await loadedSession();
    renderPage();

    expect(screen.getByText('Încasări · 3 achitări')).toBeInTheDocument();
    expect(screen.getAllByText('2.300,00 lei').length).toBeGreaterThan(0); // 1000 + 500 + 800
    expect(screen.getByText('Cheltuieli · 1')).toBeInTheDocument();
    expect(screen.getAllByText('+1.900,00 lei').length).toBeGreaterThan(0); // 2300 - 400
  });

  it('lista „Pentru taxe în EUR” arată suma EUR salvată pe achitare, nu una recalculată', async () => {
    await loadedSession();
    renderPage();

    expect(screen.getByText('40,53 €')).toBeInTheDocument();
    expect(screen.getByText('19,7400')).toBeInTheDocument();
  });

  it('achitarea neasociată contribuie la totalul de încasări, deși nu are copil', async () => {
    await loadedSession();
    renderPage();

    // 1000 (c1) + 500 (neasociată) + 800 (c1) = 2300 — vezi cardul „Încasări”.
    expect(screen.getAllByText('2.300,00 lei').length).toBeGreaterThan(0);
  });

  it('tabelul „Pe zile” are doar zilele cu mișcări, cu rândul Total la final', async () => {
    await loadedSession();
    renderPage();

    expect(screen.getByText('Pe zile')).toBeInTheDocument();
    expect(screen.getByText('Total lună')).toBeInTheDocument();
  });

  it('deschide panoul de export la click pe butonul din antet, cu avertizarea de achitări neasociate', async () => {
    await loadedSession();
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Exportă pentru contabil' }));
    expect(screen.getByRole('dialog', { name: 'Exportă pentru contabil' })).toBeInTheDocument();
    expect(screen.getByText('1 achitare neasociată')).toBeInTheDocument();
  });

  it('schimbarea modului în Trimestru păstrează alegerea (usePersistedState)', async () => {
    await loadedSession();
    renderPage();

    await userEvent.click(screen.getByRole('radio', { name: 'Trimestru' }));
    expect(localStorage.getItem('view.report')).toBe('quarter');
  });
});
