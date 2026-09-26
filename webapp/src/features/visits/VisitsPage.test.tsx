import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { TopbarActionsProvider, useTopbarActionsSlot } from '../../app/shell/TopbarActions';
import { VisitsPage } from './VisitsPage';

/** Randează slot-ul de antet ca Topbar-ul real — butonul „+ Programează vizită" ajunge acolo, nu în pagină. */
function TopbarActionsSlot() {
  return <>{useTopbarActionsSlot()}</>;
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Vizitele trebuie să cadă în luna curentă (filtrul implicit din useVisits pornește
// din today()) — o dată fixă ar deveni flaky pe măsură ce trece timpul, ca la ziua
// de naștere din useDashboard.test.ts.
const TODAY = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const fixtureState = {
  children: [],
  payments: [],
  expenses: [],
  groups: [{ id: 'g1', name: 'Fluturași', capacity: 15 }],
  categories: [],
  visits: [
    {
      id: 'VIZ-1',
      name: 'Andrei Popescu',
      parent: 'Maria Popescu',
      phone: '0722000001',
      date: TODAY,
      time: '10:00',
      status: 'Programată',
      statusChangedAt: `${TODAY}T10:00:00.000Z`,
      history: [{ at: `${TODAY}T10:00:00.000Z`, status: 'Programată', date: TODAY, time: '10:00' }],
      desiredGroupId: null,
      childId: '',
      archived: false,
    },
    {
      id: 'VIZ-2',
      name: 'Maria Ionescu',
      parent: 'Ioana Ionescu',
      phone: '',
      date: TODAY,
      time: '11:30',
      status: 'Efectuată',
      statusChangedAt: `${TODAY}T10:00:00.000Z`,
      history: [],
      desiredGroupId: 'g1',
      childId: '',
      archived: false,
    },
  ],
};

function renderPage() {
  return render(
    <ToastProvider>
      <TopbarActionsProvider>
        <TopbarActionsSlot />
        <VisitsPage />
      </TopbarActionsProvider>
    </ToastProvider>,
  );
}

describe('VisitsPage', () => {
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
            visits:
              body.mode === 'create'
                ? [...fixtureState.visits, body.record]
                : fixtureState.visits.map(v => (v.id === body.record.id ? body.record : v)),
          };
          return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        }
        if (path === '/api/record-delete') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const updated = { ...fixtureState, visits: fixtureState.visits.filter(v => v.id !== body.id) };
          return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        }
        if (path === '/api/visits-enrol') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          return jsonResponse({
            state: fixtureState,
            revision: 2,
            updatedAt: '2026-09-23T10:05:00Z',
            childId: body.child.id,
          });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  it('arată pâlnia și rândurile din tabel pentru luna curentă', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    expect(screen.getByText('programate')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Andrei Popescu')).toBeInTheDocument();
    expect(within(table).getByText('Maria Ionescu')).toBeInTheDocument();
  });

  it('adaugă o vizită nouă din formular', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '+ Programează vizită' }));
    expect(screen.getByRole('dialog', { name: 'Adaugă: vizită' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nume copil'), 'Radu Ionescu');
    await user.type(screen.getByLabelText('Părinte 1'), 'Vasile Ionescu');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Vizită adăugată.')).toBeInTheDocument();
  });

  it('butonul rapid de statut trece o vizită Programată în Efectuată', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    const table = screen.getByRole('table');
    const row = within(table).getByText('Andrei Popescu').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Efectuată' }));

    // După ce sesiunea preia statul actualizat de la server, singurul buton rapid rămas e „Renunțat".
    expect(await within(row).findByRole('button', { name: 'Renunțat' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Neprezentată' })).not.toBeInTheDocument();
  });

  it('„Înscrie copilul" apare doar pentru o vizită Efectuată și deschide formularul de înscriere', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    const table = screen.getByRole('table');
    const doneRow = within(table).getByText('Maria Ionescu').closest('tr')!;
    const scheduledRow = within(table).getByText('Andrei Popescu').closest('tr')!;
    expect(within(scheduledRow).queryByRole('button', { name: 'Înscrie copilul' })).not.toBeInTheDocument();

    await user.click(within(doneRow).getByRole('button', { name: 'Înscrie copilul' }));
    expect(screen.getByRole('dialog', { name: 'Înscrie copilul: Maria Ionescu' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Înscrie' }));
    expect(await screen.findByText('Copil înscris. Vizita a fost marcată „Înscris”.')).toBeInTheDocument();
  });

  it('ștergerea definitivă rămâne dezactivată pentru o vizită nearhivată', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const table = screen.getByRole('table');
    const row = within(table).getByText('Andrei Popescu').closest('tr')!;
    expect(within(row).getByRole('button', { name: 'Șterge' })).toBeDisabled();
  });

  it('bifarea „Arhivate" și „Toate lunile" nu aruncă erori', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Arhivate'));
    await user.click(screen.getByLabelText('Toate lunile'));

    const table = screen.getByRole('table');
    expect(within(table).getByText('Andrei Popescu')).toBeInTheDocument();
  });
});
