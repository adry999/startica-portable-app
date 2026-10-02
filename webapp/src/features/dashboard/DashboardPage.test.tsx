import { act, render, renderHook, screen, within } from '@testing-library/react';
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

function stubFetch(state: unknown = fixtureState, health: unknown = { lastExternal: new Date().toISOString() }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
      if (path === '/api/state') return jsonResponse({ state, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
      if (path === '/api/health') return jsonResponse(health);
      // 45c: useDashboard cere prezența zilei curente/trecute pentru „Prezență nemarcată".
      if (path.startsWith('/api/attendance?date=')) return jsonResponse({ entries: [] });
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    stubFetch();
  });

  it('arată starea de încărcare înainte ca sesiunea să fie gata', () => {
    vi.useFakeTimers();
    try {
      renderDashboard({ month: '2026-09', onNavigate: () => {} });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByRole('status', { name: 'Se încarcă…' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('randează KPI-urile după încărcare', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderDashboard({ month: '2026-09', onNavigate: () => {} });
    expect(screen.getByText('Încasări', { selector: 'p' })).toBeInTheDocument();
    // Venit și diferență (egale, fără cheltuieli în fixtură) — KPI-urile sunt fără zecimale.
    expect(screen.getAllByText('1.500 lei').length).toBeGreaterThanOrEqual(2);
  });

  it('navighează la formularul de cheltuială nouă din link-ul cardului', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());
    const onNavigate = vi.fn();

    renderDashboard({ month: '2026-09', onNavigate });
    await userEvent.click(screen.getByRole('button', { name: '+ Adaugă cheltuială' }));
    expect(onNavigate).toHaveBeenCalledWith('expenses', { nou: '1' });
  });

  it('dashboard.attention.first: fără niciun copil, cardul „Necesită atenție” arată „Adaugă primii copii”', async () => {
    stubFetch({ ...fixtureState, children: [], payments: [] });
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());
    const onNavigate = vi.fn();

    renderDashboard({ month: '2026-09', onNavigate });
    expect(screen.getByText('Adaugă primii copii')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copil nou' }));
    expect(onNavigate).toHaveBeenCalledWith('children', { nou: '1' });
  });

  it('dashboard.revenue.first: fără nicio plată/cheltuială în ultimele 12 luni, graficul arată un mesaj în loc să rămână gol', async () => {
    stubFetch({ ...fixtureState, payments: [], expenses: [] });
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderDashboard({ month: '2026-09', onNavigate: () => {} });
    expect(screen.getByText('Niciun venit sau cheltuială înregistrată încă')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /încasări.*cheltuieli/ })).not.toBeInTheDocument();
  });

  it('A8: graficul Evoluția încasărilor arată legenda cu pătrate, nu comutatorul Încasări/Cheltuieli', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderDashboard({ month: '2026-09', onNavigate: () => {} });
    expect(screen.queryByRole('radiogroup', { name: /Evoluția încasărilor/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /încasări 1\.500,00 lei, cheltuieli 0,00 lei/ })).toBeInTheDocument();
  });

  it('A8: hover pe o lună din grafic arată tooltipul cu diferența', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());
    const user = userEvent.setup();

    renderDashboard({ month: '2026-09', onNavigate: () => {} });
    const currentMonthBar = screen.getByRole('button', { name: /încasări 1\.500,00 lei/ });
    await user.hover(currentMonthBar);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('diferență 1.500 lei');
  });

  it('45c: „Necesită atenție" arată „Date incomplete" (fișa de bază e incompletă) cu link spre Copii', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());
    const onNavigate = vi.fn();

    renderDashboard({ month: '2026-09', onNavigate });

    const row = screen.getByText('Copii cu date obligatorii lipsă').closest('article') as HTMLElement;
    expect(within(row).getByText('1')).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: 'Completează →' }));
    expect(onNavigate).toHaveBeenCalledWith('children', { filtru: 'incomplete' });
  });

  it('45c: fără nicio problemă, cardul arată „Nimic de rezolvat azi." (dashboard.attention.done)', async () => {
    stubFetch({
      children: [
        {
          id: 'c1',
          name: 'Complet Ionescu',
          status: 'Activ',
          groupId: 'g1',
          parent: 'Un părinte',
          phone: '069000009',
          parent2: 'Alt părinte',
          idnp: '2001234567890',
          pickupPersons: [{ id: 'P1', name: 'Bunica' }],
          fee: 1500,
          feeHistory: [{ from: '2020-01', amount: 1500 }],
          dueDay: 10,
          attendanceDate: '2099-01-01',
          birthDate: '2020-01-01',
          archived: false,
        },
      ],
      payments: [
        {
          id: 'p1',
          date: '2026-09-01',
          childId: 'c1',
          amount: 1500,
          method: 'Cash',
          allocations: [{ month: '2026-09', amount: 1500 }],
          archived: false,
        },
      ],
      expenses: [],
      groups: [{ id: 'g1', name: 'Mars', capacity: 10 }],
      categories: [],
      visits: [],
    });
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderDashboard({ month: '2026-09', onNavigate: () => {} });

    expect(await screen.findByText('Nimic de rezolvat azi.')).toBeInTheDocument();
  });

  it('45c: restanțele (Situația) duc la ?segment=overdue', async () => {
    stubFetch({
      children: [
        {
          id: 'c1',
          name: 'Restanțier',
          status: 'Activ',
          groupId: 'g1',
          parent: 'Un părinte',
          phone: '069000009',
          parent2: 'Alt părinte',
          idnp: '2001234567890',
          pickupPersons: [{ id: 'P1', name: 'Bunica' }],
          fee: 1500,
          feeHistory: [{ from: '2020-01', amount: 1500 }],
          statusHistory: [],
          dueDay: 1,
          // 2020-01-01, nu în viitor: un attendanceDate în viitor face copilul „inactiv" pe
          // luna 2026-09 (obligation() din tuition-obligation.mjs), deci fără Restanță.
          attendanceDate: '2020-01-01',
          birthDate: '2020-01-01',
          archived: false,
        },
      ],
      payments: [],
      expenses: [],
      groups: [{ id: 'g1', name: 'Mars', capacity: 10 }],
      categories: [],
      visits: [],
    });
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());
    const onNavigate = vi.fn();

    renderDashboard({ month: '2026-09', onNavigate });

    const row = (await screen.findByText('Restanțe peste scadență')).closest('article') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Vezi situația →' }));
    expect(onNavigate).toHaveBeenCalledWith('status', { segment: 'overdue' });
  });

  it('F24: backup extern vechi duce spre Setări (backup-si-setari)', async () => {
    stubFetch({ ...fixtureState }, { lastExternal: new Date(Date.now() - 10 * 86400000).toISOString() });
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());
    const onNavigate = vi.fn();

    renderDashboard({ month: '2026-09', onNavigate });

    const row = await screen.findByText('Backup-ul extern are 10 zile');
    await userEvent.click(within(row.closest('article') as HTMLElement).getByRole('button', { name: 'Fă backup →' }));
    expect(onNavigate).toHaveBeenCalledWith('settings', undefined);
  });

  it('arată un chip separat pentru fiecare copil cu ziua de naștere în aceeași zi', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-05T12:00:00'));
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (path: string) => {
          if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
          if (path === '/api/state')
            return jsonResponse({
              state: {
                ...fixtureState,
                children: [
                  { ...fixtureState.children[0], birthDate: '2015-09-27' },
                  {
                    id: 'c2',
                    name: 'Maria Ionescu',
                    status: 'Activ',
                    groupId: null,
                    parent: '',
                    phone: '',
                    fee: 1500,
                    feeHistory: [],
                    dueDay: 10,
                    birthDate: '2016-09-27',
                    archived: false,
                  },
                ],
              },
              revision: 1,
              updatedAt: '2026-09-23T10:00:00Z',
            });
          if (path === '/api/health') return jsonResponse({});
          throw new Error(`neașteptat: ${path}`);
        }),
      );

      const session = renderHook(() => useAppSession());
      await act(() => session.result.current.load());

      renderDashboard({ month: '2026-09', onNavigate: () => {} });

      expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();
      expect(screen.getByText('Maria Ionescu')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
