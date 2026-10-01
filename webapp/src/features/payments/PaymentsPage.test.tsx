import { useState } from 'react';
import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider, TopbarActionsProvider, useTopbarActionsSlot } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import { PaymentsPage } from './PaymentsPage';

/** Randează slot-ul de antet ca Topbar-ul real — comutatorul și butoanele ajung acolo, nu în pagină. */
function TopbarActionsSlot() {
  return <>{useTopbarActionsSlot()}</>;
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [
    { id: 'c1', name: 'Andrei Popescu', groupId: null, archived: false },
    { id: 'c2', name: 'Maria Ionescu', groupId: null, archived: false },
  ],
  payments: [
    {
      id: 'p1',
      date: '2026-09-10',
      childId: 'c1',
      amount: 1500,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 1500 }],
      allocations: [{ month: '2026-09', amount: 1500 }],
      archived: false,
    },
    {
      id: 'p4',
      date: '2026-09-02',
      childId: '',
      sourceName: 'Import CSV',
      amount: 300,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 300 }],
      allocations: [],
      archived: false,
    },
  ],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
};

function PaymentsHarness({ onOpenChild = () => {} }: { onOpenChild?: (id: string) => void }) {
  const [formTargetId, setFormTargetId] = useState<string | null>(null);
  return (
    <PaymentsPage
      formTargetId={formTargetId}
      onOpenCreate={() => setFormTargetId('nou')}
      onOpenEdit={id => setFormTargetId(id)}
      onCloseForm={() => setFormTargetId(null)}
      onOpenChild={onOpenChild}
    />
  );
}

function renderPage(onOpenChild?: (id: string) => void) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TopbarActionsProvider>
          <TopbarActionsSlot />
          <PaymentsHarness onOpenChild={onOpenChild} />
        </TopbarActionsProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

/** Pentru testele care verifică navigarea (Neasociată →, Schimbă copilul, Tipărește confirmarea). */
function renderPageWithLocation() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TopbarActionsProvider>
          <TopbarActionsSlot />
          <LocationDisplay />
          <PaymentsHarness />
        </TopbarActionsProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('PaymentsPage', () => {
  // Mutabil, resetat la fiecare test — altfel o a doua mutație din aceeași interacțiune (ex.
  // arhivarea secvențială a mai multor rânduri, M1) ar porni mereu de la fixtureState-ul
  // static și ar anula modificarea primei (la fel ca `currentExpenses` din ExpensesPage.test.tsx).
  let currentPayments = fixtureState.payments;

  beforeEach(() => {
    currentPayments = fixtureState.payments;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        if (path === '/api/record') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          currentPayments =
            body.mode === 'create'
              ? [...currentPayments, body.record]
              : currentPayments.map(p => (p.id === body.record.id ? body.record : p));
          return jsonResponse({
            state: { ...fixtureState, payments: currentPayments },
            revision: 2,
            updatedAt: '2026-09-23T10:05:00Z',
          });
        }
        if (path === '/api/record-delete') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const ids: string[] = body.ids ?? (body.id ? [body.id] : []);
          currentPayments = currentPayments.filter(p => !ids.includes(p.id));
          return jsonResponse({
            state: { ...fixtureState, payments: currentPayments },
            revision: 2,
            updatedAt: '2026-09-23T10:05:00Z',
          });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată starea de încărcare înainte ca sesiunea să fie gata', () => {
    vi.useFakeTimers();
    try {
      renderPage();
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByRole('status', { name: 'Se încarcă…' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('butonul „Bon zi" navighează la bonul de închidere a zilei de azi', async () => {
    await loadedSession();
    renderPageWithLocation();

    await userEvent.click(screen.getByRole('button', { name: 'Bon zi' }));

    expect(screen.getByTestId('location').textContent).toMatch(/^\/achitari\/bon-zi\?zi=\d{4}-\d{2}-\d{2}$/);
  });

  it('randează rândurile din tabel cu sumarul pe metodă', async () => {
    await loadedSession();
    renderPage();

    expect(screen.getByText(/Total filtrat/)).toBeInTheDocument();
    expect(screen.getAllByText('Andrei Popescu').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Import CSV').length).toBeGreaterThan(0);
    expect(screen.getByText('Neasociată →')).toBeInTheDocument();
  });

  it('click pe un rând cu copil asociat deschide fișa copilului', async () => {
    await loadedSession();
    const onOpenChild = vi.fn();
    renderPage(onOpenChild);

    const table = screen.getByRole('table');
    const row = within(table).getByText('Andrei Popescu').closest('tr')!;
    await userEvent.click(row);

    expect(onOpenChild).toHaveBeenCalledWith('c1');
  });

  it('click pe un rând neasociat nu apelează onOpenChild', async () => {
    await loadedSession();
    const onOpenChild = vi.fn();
    renderPage(onOpenChild);

    const table = screen.getByRole('table');
    const row = within(table).getAllByText('Import CSV')[0].closest('tr')!;
    await userEvent.click(row);

    expect(onOpenChild).not.toHaveBeenCalled();
  });

  it('click pe butoanele din rând nu deschide fișa copilului', async () => {
    await loadedSession();
    const onOpenChild = vi.fn();
    renderPage(onOpenChild);

    const table = screen.getByRole('table');
    const row = within(table).getByText('Andrei Popescu').closest('tr')!;
    await userEvent.click(within(row).getByLabelText('Mai multe acțiuni'));
    await userEvent.click(within(row).getByRole('button', { name: 'Editează' }));

    expect(onOpenChild).not.toHaveBeenCalled();
  });

  it('arhivează o achitare din rândul tabelului', async () => {
    await loadedSession();
    renderPage();

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.record.id).toBe('p1');
      expect(body.record.archived).toBe(true);
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    const table = screen.getByRole('table');
    const row = within(table).getByText('Andrei Popescu').closest('tr')!;
    await userEvent.click(within(row).getByLabelText('Mai multe acțiuni'));
    await userEvent.click(within(row).getByRole('button', { name: 'Arhivează' }));

    expect(await screen.findByText('Achitare arhivată.')).toBeInTheDocument();
  });

  it('comută pe vizualizarea "Pe luna încasării" și arată gruparea cu subtotal', async () => {
    await loadedSession();
    renderPage();

    await userEvent.click(screen.getByRole('radio', { name: 'Pe luna încasării' }));

    expect(screen.getAllByText(/^Sep 2026/).length).toBeGreaterThan(0);
  });

  it('adaugă o achitare nouă din formular', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '+ Achitare nouă' }));
    const dialog = screen.getByRole('dialog', { name: 'Achitare nouă' });

    await user.click(within(dialog).getByRole('button', { name: 'Copil' }));
    await user.click(screen.getByRole('option', { name: 'Maria Ionescu' }));
    await user.type(within(dialog).getByLabelText('Sumă'), '600');
    await user.click(within(dialog).getByRole('button', { name: /^Salvează/ }));

    expect(await screen.findByText('Achitare adăugată.')).toBeInTheDocument();
  });

  it('editează o achitare existentă din meniul rândului', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    const table = screen.getByRole('table');
    const row = within(table).getByText('Andrei Popescu').closest('tr')!;
    await user.click(within(row).getByLabelText('Mai multe acțiuni'));
    await user.click(within(row).getByRole('button', { name: 'Editează' }));

    const dialog = screen.getByRole('dialog', { name: 'Editează achitarea' });
    const cashInput = within(dialog).getByLabelText('Sumă') as HTMLInputElement;
    expect(cashInput.value).toBe('1500');
    await user.clear(cashInput);
    await user.type(cashInput, '1600');
    await user.click(within(dialog).getByRole('button', { name: /^Salvează/ }));

    expect(await screen.findByText('Achitare actualizată.')).toBeInTheDocument();
  });

  it('ștergerea definitivă rămâne dezactivată pentru o achitare activă', async () => {
    await loadedSession();
    renderPage();

    const table = screen.getByRole('table');
    const row = within(table).getByText('Andrei Popescu').closest('tr')!;
    await userEvent.click(within(row).getByLabelText('Mai multe acțiuni'));
    expect(within(row).getByRole('button', { name: 'Șterge definitiv' })).toBeDisabled();
  });

  it('la o achitare nouă duplicat, confirmarea utilizatorului o creează totuși', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await user.click(screen.getByRole('button', { name: '+ Achitare nouă' }));
    const dialog = screen.getByRole('dialog', { name: 'Achitare nouă' });

    await user.click(within(dialog).getByRole('button', { name: 'Copil' }));
    await user.click(screen.getByRole('option', { name: 'Andrei Popescu' }));
    const dateInput = within(dialog).getByLabelText('Data');
    await user.clear(dateInput);
    await user.type(dateInput, '2026-09-10');
    await user.type(within(dialog).getByLabelText('Sumă'), '1500');
    await user.click(within(dialog).getByRole('button', { name: /^Salvează/ }));

    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByText('Achitare adăugată.')).toBeInTheDocument();
  });

  it('la o achitare nouă duplicat, refuzul utilizatorului nu creează nimic', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await user.click(screen.getByRole('button', { name: '+ Achitare nouă' }));
    const dialog = screen.getByRole('dialog', { name: 'Achitare nouă' });

    await user.click(within(dialog).getByRole('button', { name: 'Copil' }));
    await user.click(screen.getByRole('option', { name: 'Andrei Popescu' }));
    const dateInput = within(dialog).getByLabelText('Data');
    await user.clear(dateInput);
    await user.type(dateInput, '2026-09-10');
    await user.type(within(dialog).getByLabelText('Sumă'), '1500');
    await user.click(within(dialog).getByRole('button', { name: /^Salvează/ }));

    expect(window.confirm).toHaveBeenCalled();
    expect(screen.queryByText('Achitare adăugată.')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Achitare nouă' })).toBeInTheDocument();
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([path]) => path === '/api/record')).toHaveLength(0);
  });

  it('o mutație respinsă la editare arată eroarea ca toast', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    const table = screen.getByRole('table');
    const row = within(table).getByText('Andrei Popescu').closest('tr')!;
    await user.click(within(row).getByLabelText('Mai multe acțiuni'));
    await user.click(within(row).getByRole('button', { name: 'Editează' }));

    const dialog = screen.getByRole('dialog', { name: 'Editează achitarea' });
    const cashInput = within(dialog).getByLabelText('Sumă') as HTMLInputElement;
    await user.clear(cashInput);
    await user.type(cashInput, '1600');

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Suma nu poate fi negativă.' }),
    }));

    await user.click(within(dialog).getByRole('button', { name: /^Salvează/ }));

    expect(await screen.findByText('Suma nu poate fi negativă.')).toBeInTheDocument();
    expect(screen.queryByText('Achitare actualizată.')).not.toBeInTheDocument();
  });

  it('selectează două rânduri, arhivează selecția și golește selecția', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    const checkboxes = screen.getAllByRole('checkbox', { name: 'Selectează rândul' });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    const selectionBar = screen.getByText(`2 selectate · ${formatMoney(1800)}`).closest('div')!;
    await user.click(within(selectionBar).getByRole('button', { name: 'Arhivează' }));

    expect(await screen.findByText('2 achitări arhivate.')).toBeInTheDocument();
    expect(screen.queryByText(/selectate ·/)).not.toBeInTheDocument();
  });

  it('șterge definitiv o achitare arhivată după confirmare', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    const activeTable = screen.getByRole('table');
    const activeRow = within(activeTable).getByText('Andrei Popescu').closest('tr')!;
    await user.click(within(activeRow).getByLabelText('Mai multe acțiuni'));
    await user.click(within(activeRow).getByRole('button', { name: 'Arhivează' }));
    expect(await screen.findByText('Achitare arhivată.')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Arhivate' }));

    const table = screen.getByRole('table');
    const row = within(table).getByText('Andrei Popescu').closest('tr')!;

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string, options: RequestInit) => {
      expect(path).toBe('/api/record-delete');
      const body = JSON.parse(options.body as string);
      expect(body.id).toBe('p1');
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await user.click(within(row).getByLabelText('Mai multe acțiuni'));
    await user.click(within(row).getByRole('button', { name: 'Șterge definitiv' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Ștergere definitivă' });
    await user.type(within(dialog).getByLabelText('Scrie ȘTERGE pentru confirmare'), 'ȘTERGE');
    await user.click(within(dialog).getByRole('button', { name: 'Șterge definitiv' }));

    expect(await screen.findByText('Achitare ștearsă definitiv.')).toBeInTheDocument();
  });

  it('B2: arhivează 2 achitări, apoi le șterge definitiv în lot din bara de selecție', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    const checkboxes = screen.getAllByRole('checkbox', { name: 'Selectează rândul' });
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    let selectionBar = screen.getByText(`2 selectate · ${formatMoney(1800)}`).closest('div')!;
    await user.click(within(selectionBar).getByRole('button', { name: 'Arhivează' }));
    expect(await screen.findByText('2 achitări arhivate.')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Arhivate' }));
    const archivedCheckboxes = screen.getAllByRole('checkbox', { name: 'Selectează rândul' });
    await user.click(archivedCheckboxes[0]);
    await user.click(archivedCheckboxes[1]);

    selectionBar = screen.getByText(`2 selectate · ${formatMoney(1800)}`).closest('div')!;
    // Dezarhivează, nu Arhivează, cât filtrul e Arhivate.
    expect(within(selectionBar).getByRole('button', { name: 'Dezarhivează' })).toBeInTheDocument();

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string, options: RequestInit) => {
      expect(path).toBe('/api/record-delete');
      const body = JSON.parse(options.body as string);
      expect(body.ids.sort()).toEqual(['p1', 'p4']);
      return jsonResponse({ state: { ...fixtureState, payments: [] }, revision: 3, updatedAt: '2026-09-23T10:06:00Z' });
    });

    await user.click(within(selectionBar).getByRole('button', { name: 'Șterge definitiv' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Ștergi definitiv 2 achitări?' });
    await user.type(within(dialog).getByLabelText('Scrie ȘTERGE pentru confirmare'), 'ȘTERGE');
    await user.click(within(dialog).getByRole('button', { name: 'Șterge 2 achitări' }));

    expect(await screen.findByText('2 achitări șterse definitiv.')).toBeInTheDocument();
  });

  it('B1: o plată mixtă (Cash + Card) se editează despărțit pe metode, fără „Altele”', async () => {
    const stateWithMixedPayment = {
      ...fixtureState,
      payments: [
        ...fixtureState.payments,
        {
          id: 'p5',
          date: '2026-09-15',
          childId: 'c2',
          amount: 200,
          method: 'Cash + Card',
          tenders: [
            { method: 'Cash', amount: 120 },
            { method: 'Card', amount: 80 },
          ],
          allocations: [],
          archived: false,
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: stateWithMixedPayment, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    expect(screen.queryByText('Altele')).not.toBeInTheDocument();

    const table = screen.getByRole('table');
    const row = within(table).getByText('Maria Ionescu').closest('tr')!;
    await user.click(within(row).getByLabelText('Mai multe acțiuni'));
    await user.click(within(row).getByRole('button', { name: 'Editează' }));

    const dialog = screen.getByRole('dialog', { name: 'Editează achitarea' });
    expect((within(dialog).getByLabelText('Cash') as HTMLInputElement).value).toBe('120');
    expect((within(dialog).getByLabelText('Card') as HTMLInputElement).value).toBe('80');
    expect(within(dialog).getByText(`Total: ${formatMoney(200)}`)).toBeInTheDocument();
  });

  it('coloana Metodă arată suma doar când plata e despărțită pe mai multe metode', async () => {
    const stateWithMixedPayment = {
      ...fixtureState,
      payments: [
        ...fixtureState.payments,
        {
          id: 'p5',
          date: '2026-09-15',
          childId: 'c2',
          amount: 200,
          method: 'Cash + Card',
          tenders: [
            { method: 'Cash', amount: 120 },
            { method: 'Card', amount: 80 },
          ],
          allocations: [],
          archived: false,
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: stateWithMixedPayment, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    await loadedSession();
    renderPage();

    const table = screen.getByRole('table');

    const singleTenderRow = within(table).getByText('Andrei Popescu').closest('tr')!;
    expect(within(singleTenderRow).getByText('Cash')).toBeInTheDocument();
    expect(within(singleTenderRow).queryByText(`Cash ${formatMoney(1500)}`)).not.toBeInTheDocument();
    // Suma apare o singură dată pe rând (coloana Total) — nu și repetată în coloana Metodă.
    expect(within(singleTenderRow).getAllByText(formatMoney(1500))).toHaveLength(1);

    const splitTenderRow = within(table).getByText('Maria Ionescu').closest('tr')!;
    expect(within(splitTenderRow).getByText(`Cash ${formatMoney(120)}`)).toBeInTheDocument();
    expect(within(splitTenderRow).getByText(`Card ${formatMoney(80)}`)).toBeInTheDocument();
  });

  it('B3: coloana Serviciu arată pastila corectă și grupul FilterPills „Serviciu” filtrează rândurile', async () => {
    const stateWithServices = {
      ...fixtureState,
      services: [
        { id: 'gradinita', name: 'Grădiniță', order: 0, tone: 'orange', priceMode: 'free', system: true },
        { id: 'bazin', name: 'Bazin', order: 1, tone: 'blue', priceMode: 'free', system: true },
      ],
      payments: [
        ...fixtureState.payments,
        {
          id: 'p6',
          date: '2026-09-12',
          childId: 'c2',
          amount: 250,
          method: 'Cash',
          tenders: [{ method: 'Cash', amount: 250 }],
          allocations: [],
          archived: false,
          service: 'bazin',
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: stateWithServices, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/exchange-rates') return jsonResponse({ rates: {}, sources: {} });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    await loadedSession();
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('columnheader', { name: /Serviciu/ })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByText('Grădiniță').length).toBeGreaterThan(0);
    expect(within(table).getByText('Bazin')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Bazin' }));

    expect(screen.queryByText('Andrei Popescu')).not.toBeInTheDocument();
    expect(screen.getAllByText('Maria Ionescu').length).toBeGreaterThan(0);
  });

  it('badge-link „Neasociată →" navighează la Asociere achitări cu id-ul plății', async () => {
    await loadedSession();
    const user = userEvent.setup();
    renderPageWithLocation();

    await user.click(screen.getByText('Neasociată →'));

    expect(screen.getByTestId('location').textContent).toBe('/asociere-achitari?id=p4');
  });

  it('„Schimbă copilul" din meniul rândului navighează la Asociere achitări cu id-ul plății', async () => {
    await loadedSession();
    const user = userEvent.setup();
    renderPageWithLocation();

    const table = screen.getByRole('table');
    const row = within(table).getByText('Andrei Popescu').closest('tr')!;
    await user.click(within(row).getByLabelText('Mai multe acțiuni'));
    await user.click(within(row).getByRole('button', { name: 'Schimbă copilul' }));

    expect(screen.getByTestId('location').textContent).toBe('/asociere-achitari?id=p1');
  });

  it('„Tipărește confirmarea" din meniul rândului navighează la confirmarea de plată', async () => {
    await loadedSession();
    const user = userEvent.setup();
    renderPageWithLocation();

    const table = screen.getByRole('table');
    const row = within(table).getByText('Andrei Popescu').closest('tr')!;
    await user.click(within(row).getByLabelText('Mai multe acțiuni'));
    await user.click(within(row).getByRole('button', { name: 'Tipărește confirmarea' }));

    expect(screen.getByTestId('location').textContent).toBe('/achitari/p1/confirmare');
  });

  describe('Pe luna încasării', () => {
    it('grupează achitările pe lună și arată panoul de detaliu pentru rândul activ', async () => {
      await loadedSession();
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('radio', { name: 'Pe luna încasării' }));

      expect(screen.getAllByText(/septembrie 2026/i).length).toBeGreaterThan(0);
      // Primul rând al grupului (p1) e activ implicit — panoul arată datele lui.
      expect(screen.getByText('Achitare · 10.09.2026')).toBeInTheDocument();
    });

    it('click pe un rând din listă îi deschide panoul de detaliu', async () => {
      await loadedSession();
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('radio', { name: 'Pe luna încasării' }));
      const importRow = screen.getAllByText(/Import CSV/)[0].closest('[role="button"]')!;
      await user.click(importRow);

      expect(screen.getByText('Achitare · 02.09.2026')).toBeInTheDocument();
    });

    it('pastila „Neasociate" filtrează lista doar la achitările neasociate', async () => {
      await loadedSession();
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('radio', { name: 'Pe luna încasării' }));
      await user.click(screen.getByRole('radio', { name: /Neasociate ·/ }));

      expect(screen.queryByText('Andrei Popescu')).not.toBeInTheDocument();
      expect(screen.getAllByText('Import CSV').length).toBeGreaterThan(0);
    });

    it('panoul de detaliu are link „Asociază în De rezolvat →", nu un formular de asociere', async () => {
      await loadedSession();
      const user = userEvent.setup();
      renderPageWithLocation();

      await user.click(screen.getByRole('radio', { name: 'Pe luna încasării' }));
      await user.click(screen.getByRole('button', { name: 'Asociază în De rezolvat →' }));

      expect(screen.getByTestId('location').textContent).toMatch(/^\/asociere-achitari\?id=/);
    });
  });
});
