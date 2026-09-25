import { useState } from 'react';
import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { TopbarActionsProvider, useTopbarActionsSlot } from '../../app/shell/TopbarActions';
import { ChildrenPage } from './ChildrenPage';

/** Randează slot-ul de antet ca Topbar-ul real — butoanele „Import CSV"/„+ Adaugă copil" ajung acolo, nu în pagină. */
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
      archived: false,
    },
    {
      id: 'c2',
      name: 'Maria Ionescu',
      status: 'Activ',
      groupId: null,
      parent: 'Ioana Ionescu',
      phone: '0722000002',
      fee: 2000,
      feeHistory: [{ from: '2020-01', amount: 2000 }],
      statusHistory: [],
      dueDay: 28,
      attendanceDate: '2022-09-01',
      birthDate: '2019-05-10',
      archived: false,
    },
    {
      id: 'c3',
      name: 'Ionuț Marin',
      status: 'Activ',
      groupId: null,
      parent: 'Elena Marin',
      phone: '0722000003',
      fee: 1200,
      feeHistory: [{ from: '2020-01', amount: 1200 }],
      statusHistory: [],
      dueDay: 5,
      attendanceDate: '2022-09-01',
      birthDate: '2018-03-01',
      archived: true,
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
  ],
  expenses: [],
  groups: [{ id: 'g1', name: 'Fluturași', capacity: 15 }],
  categories: [],
  visits: [],
};

function ChildrenHarness() {
  const [childId, setChildId] = useState<string | null>(null);
  return (
    <ChildrenPage
      month="2026-09"
      onNavigate={() => {}}
      childId={childId}
      onOpenChild={setChildId}
      onCloseChild={() => setChildId(null)}
    />
  );
}

function renderPage() {
  return render(
    <ToastProvider>
      <TopbarActionsProvider>
        <TopbarActionsSlot />
        <ChildrenHarness />
      </TopbarActionsProvider>
    </ToastProvider>,
  );
}

describe('ChildrenPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/record') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const updated = {
            ...fixtureState,
            children:
              body.mode === 'create'
                ? [...fixtureState.children, body.record]
                : fixtureState.children.map(c => (c.id === body.record.id ? body.record : c)),
          };
          return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        }
        if (path === '/api/record-delete') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const updated = { ...fixtureState, children: fixtureState.children.filter(c => c.id !== body.id) };
          return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  it('arată un mesaj de încărcare înainte ca sesiunea să fie gata', () => {
    renderPage();
    expect(screen.getByText('Se încarcă datele…')).toBeInTheDocument();
  });

  it('arată doar copiii activi implicit, cu statisticile din antet', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();
    expect(screen.getByText('Maria Ionescu')).toBeInTheDocument();
    expect(screen.queryByText('Ionuț Marin')).not.toBeInTheDocument(); // arhivat, ascuns din filtrul implicit

    const activeStatCard = screen.getByText('Copii activi').closest('div')!.parentElement!;
    expect(within(activeStatCard).getByText('2')).toBeInTheDocument();
  });

  it('deschide fișa copilului la click pe rând și revine la listă din breadcrumb', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    await userEvent.click(screen.getByText('Andrei Popescu'));

    expect(screen.getByRole('heading', { name: 'Andrei Popescu' })).toBeInTheDocument();
    expect(screen.getByText(/Contract 7/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Copii' }));
    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Andrei Popescu' })).not.toBeInTheDocument();
  });

  it('arhivează copilul selectat prin bara de selecție și afișează un toast', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const row = screen.getByText('Maria Ionescu').closest('tr')!;
    await userEvent.click(within(row).getByRole('checkbox'));

    const selectionBar = screen.getByText('1 selectați').closest('div')!;
    await userEvent.click(within(selectionBar).getByRole('button', { name: 'Arhivează' }));

    expect(await screen.findByText('1 copil arhivat')).toBeInTheDocument();
  });

  it('adaugă un copil nou din formular', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '+ Adaugă copil' }));
    expect(screen.getByRole('dialog', { name: 'Adaugă: copil' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nume copil'), 'Radu Ionescu');
    await user.type(screen.getByLabelText('Părinte 1'), 'Vasile Ionescu');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Copil adăugat.')).toBeInTheDocument();
    expect(screen.getByText('Radu Ionescu')).toBeInTheDocument();
  });

  it('editează fișa unui copil existent din meniul rândului', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    const row = screen.getByText('Andrei Popescu').closest('tr')!;
    await user.click(within(row).getByLabelText('Mai multe acțiuni'));
    await user.click(within(row).getByRole('button', { name: 'Editează' }));

    expect(screen.getByRole('dialog', { name: 'Editează: copil' })).toBeInTheDocument();
    const nameInput = screen.getByLabelText('Nume copil') as HTMLInputElement;
    expect(nameInput.value).toBe('Andrei Popescu');
    await user.clear(nameInput);
    await user.type(nameInput, 'Andrei Popescu-Ilie');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Fișă actualizată.')).toBeInTheDocument();
  });

  it('ștergerea definitivă rămâne dezactivată pentru un copil activ', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    const row = screen.getByText('Andrei Popescu').closest('tr')!;
    await user.click(within(row).getByLabelText('Mai multe acțiuni'));
    expect(within(row).getByRole('button', { name: 'Șterge definitiv' })).toBeDisabled();
  });

  it('șterge definitiv un copil arhivat, după confirmare', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: /Arhivați/ }));
    const row = screen.getByText('Ionuț Marin').closest('tr')!;
    await user.click(within(row).getByLabelText('Mai multe acțiuni'));
    await user.click(within(row).getByRole('button', { name: 'Șterge definitiv' }));

    expect(await screen.findByText('Fișă ștearsă definitiv.')).toBeInTheDocument();
  });
});
