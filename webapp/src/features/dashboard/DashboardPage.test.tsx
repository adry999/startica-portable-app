import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { DashboardPage } from './DashboardPage';

function renderDashboard(props: Parameters<typeof DashboardPage>[0]) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <DashboardPage {...props} />
    </MemoryRouter>,
  );
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [
    {
      id: 'c1',
      name: 'Andrei Popescu',
      status: 'Activ',
      groupId: null,
      parent: '',
      phone: '',
      fee: 1500,
      feeHistory: [],
      dueDay: 10,
      birthDate: '',
      archived: false,
    },
  ],
  payments: [
    {
      id: 'p1',
      date: '2026-09-10',
      childId: 'c1',
      amount: 1500,
      method: 'Cash',
      allocations: [{ month: '2026-09', amount: 1500 }],
      archived: false,
    },
  ],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
};

describe('DashboardPage', () => {
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

  it('arată un mesaj de încărcare înainte ca sesiunea să fie gata', () => {
    renderDashboard({ month: '2026-09', onNavigate: () => {} });
    expect(screen.getByText('Se încarcă datele…')).toBeInTheDocument();
  });

  it('randează KPI-urile după încărcare', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderDashboard({ month: '2026-09', onNavigate: () => {} });
    expect(screen.getByText('Încasări', { selector: 'p' })).toBeInTheDocument();
    // Venit, diferență (egale, fără cheltuieli în fixtură) și legenda pe metodă arată aceeași sumă.
    expect(screen.getAllByText(/1\.500,00 lei/).length).toBeGreaterThanOrEqual(2);
  });

  it('navighează la ecranul cheltuielilor din link-ul cardului', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());
    const onNavigate = vi.fn();

    renderDashboard({ month: '2026-09', onNavigate });
    await userEvent.click(screen.getByRole('button', { name: '+ Adaugă cheltuială' }));
    expect(onNavigate).toHaveBeenCalledWith('expenses');
  });
});
