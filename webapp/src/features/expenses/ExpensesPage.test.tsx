import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider, TopbarActionsProvider, useTopbarActionsSlot } from '@shared/ui';
import { readDirtyForms } from '@shared/state/dirty-forms';
import { ExpensesPage } from './ExpensesPage';

/** Randează slot-ul de antet ca Topbar-ul real — comutatorul, Exportă și + Cheltuială nouă ajung acolo. */
function TopbarActionsSlot() {
  return <>{useTopbarActionsSlot()}</>;
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [],
  payments: [],
  expenses: [
    {
      id: 'e1',
      date: '2026-09-05',
      category: 'Salarii',
      description: 'Salariu septembrie',
      amount: 3000,
      archived: false,
    },
    { id: 'e2', date: '2026-09-10', category: 'Utilități', description: 'Curent', amount: 450, archived: false },
    {
      id: 'e3',
      date: '2026-09-15',
      category: 'Chirie',
      description: 'Chirie sediu',
      amount: 1000,
      archived: true,
      archivedAt: '2026-09-16T00:00:00.000Z',
    },
    // Altă lună — doar pentru testul PeriodFilter (§5.1): rămâne ascunsă de presetarea
    // implicită „Luna aceasta”, dar nu afectează totalul/categoriile lunii din KPI (filtrate separat).
    {
      id: 'e4',
      date: '2026-08-20',
      category: 'Materiale',
      description: 'Rechizite august',
      amount: 200,
      archived: false,
    },
  ],
  groups: [],
  categories: [{ id: 'cat1', name: 'Chirie' }],
  visits: [],
};

function renderPage(initialPath = '/cheltuieli') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ToastProvider>
        <TopbarActionsProvider>
          <TopbarActionsSlot />
          <ExpensesPage month="2026-09" />
        </TopbarActionsProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('ExpensesPage', () => {
  // Mutabil, resetat la fiecare test — altfel un al doilea /api/record pentru „expenses” din
  // aceeași interacțiune (ex. arhivarea secvențială a mai multor rânduri, M1) ar porni mereu
  // de la fixtureState-ul static și ar anula modificarea primului apel.
  let currentExpenses = fixtureState.expenses;

  beforeEach(() => {
    currentExpenses = fixtureState.expenses;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/record') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          if (body.type === 'expenses') {
            currentExpenses =
              body.mode === 'create'
                ? [...currentExpenses, body.record]
                : currentExpenses.map(e => (e.id === body.record.id ? body.record : e));
            const updated = { ...fixtureState, expenses: currentExpenses };
            return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
          }
          if (body.type === 'categories') {
            const updated = {
              ...fixtureState,
              categories:
                body.mode === 'create'
                  ? [...fixtureState.categories, body.record]
                  : fixtureState.categories.map(c => (c.id === body.record.id ? body.record : c)),
            };
            return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
          }
          throw new Error(`tip neașteptat: ${body.type}`);
        }
        if (path === '/api/category-delete') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const updated = { ...fixtureState, categories: fixtureState.categories.filter(c => c.id !== body.id) };
          return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        }
        if (path === '/api/category-rename') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const renamedCategory = fixtureState.categories.find(c => c.id === body.id);
          const updated = {
            ...fixtureState,
            categories: fixtureState.categories.map(c => (c.id === body.id ? { ...c, name: body.name } : c)),
            expenses: fixtureState.expenses.map(e =>
              renamedCategory && e.category === renamedCategory.name ? { ...e, category: body.name } : e,
            ),
          };
          return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        }
        if (path === '/api/record-delete') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const ids: string[] = body.ids ?? (body.id ? [body.id] : []);
          currentExpenses = currentExpenses.filter(e => !ids.includes(e.id));
          const updated = { ...fixtureState, expenses: currentExpenses };
          return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată scheletul de încărcare după 300 ms, înainte ca sesiunea să fie gata', () => {
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

  it('randează totalul lunii și cheltuielile active implicit, fără cele arhivate', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const totalCard = screen.getByText(/Total septembrie/).closest('div')!;
    expect(within(totalCard).getByText('3.450,00 lei')).toBeInTheDocument(); // 3000 + 450, active pe septembrie
    expect(screen.getByText('Salariu septembrie')).toBeInTheDocument();
    expect(screen.queryByText('Chirie sediu')).not.toBeInTheDocument(); // arhivată, filtrul implicit e „Nearhivate”
  });

  it('caută după descriere', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    await userEvent.type(screen.getByLabelText('Caută cheltuială'), 'curent');

    expect(screen.getByText('Curent')).toBeInTheDocument();
    expect(screen.queryByText('Salariu septembrie')).not.toBeInTheDocument();
  });

  it('§5.1: PeriodFilter implicit arată doar luna curentă; „Tot” arată și alte luni', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    expect(screen.getByText('Salariu septembrie')).toBeInTheDocument();
    expect(screen.queryByText('Rechizite august')).not.toBeInTheDocument(); // altă lună, ascunsă de presetarea implicită

    await userEvent.click(screen.getByRole('button', { name: /Perioadă: Luna aceasta/ }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Tot' }));

    expect(screen.getByText('Rechizite august')).toBeInTheDocument();
    expect(screen.getByText('Salariu septembrie')).toBeInTheDocument();
  });

  it('arhivează o cheltuială din meniul rândului', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const row = screen.getByText('Curent').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Arhivează' }));

    await waitFor(() => expect(screen.queryByText('Curent')).not.toBeInTheDocument());
    const totalCard = screen.getByText(/Total septembrie/).closest('div')!;
    expect(within(totalCard).getByText('3.000,00 lei')).toBeInTheDocument();
  });

  it('arhivează cheltuielile selectate prin bara de selecție', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const row = screen.getByText('Salariu septembrie').closest('tr')!;
    await userEvent.click(within(row).getByRole('checkbox'));

    expect(screen.getByText(/1 selectate/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Arhivează selectate' }));

    expect(await screen.findByText('1 cheltuială arhivată')).toBeInTheDocument();
  });

  it('„Anulează” după arhivarea mai multor cheltuieli le dezarhivează pe toate, nu doar prima (M1)', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    const row1 = screen.getByText('Salariu septembrie').closest('tr')!;
    const row2 = screen.getByText('Curent').closest('tr')!;
    await user.click(within(row1).getByRole('checkbox'));
    await user.click(within(row2).getByRole('checkbox'));

    await user.click(screen.getByRole('button', { name: 'Arhivează selectate' }));
    expect(await screen.findByText('2 cheltuieli arhivate')).toBeInTheDocument();
    expect(screen.queryByText('Salariu septembrie')).not.toBeInTheDocument();
    expect(screen.queryByText('Curent')).not.toBeInTheDocument();

    // Undo-ul era Promise.all: session.mutate refuză o a doua mutație pornită cât prima e
    // „pending”, deci doar prima cheltuială se dezarhiva. Secvențial, ambele trebuie să revină.
    await user.click(screen.getByRole('button', { name: 'Anulează' }));

    await waitFor(() => {
      expect(screen.getByText('Salariu septembrie')).toBeInTheDocument();
      expect(screen.getByText('Curent')).toBeInTheDocument();
    });
  });

  it('adaugă o categorie nouă din drawer-ul de categorii (meniul ⋯)', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Mai multe opțiuni'));
    await user.click(screen.getByRole('button', { name: 'Administrează categorii' }));

    await userEvent.type(screen.getByLabelText('Categoria nouă'), 'Reparații');
    await userEvent.click(screen.getByRole('button', { name: '+ Adaugă' }));

    expect(await screen.findByText('Categorie adăugată.')).toBeInTheDocument();
  });

  it('redenumește o categorie la click pe chip, apoi Enter', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Mai multe opțiuni'));
    await user.click(screen.getByRole('button', { name: 'Administrează categorii' }));

    await user.click(screen.getByRole('button', { name: 'Chirie' }));
    const input = screen.getByLabelText('Redenumește Chirie');
    await user.clear(input);
    await user.type(input, 'Chirie sediu{Enter}');

    expect(await screen.findByText('Categorie redenumită.')).toBeInTheDocument();
  });

  it('șterge o categorie după confirmare', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Mai multe opțiuni'));
    await user.click(screen.getByRole('button', { name: 'Administrează categorii' }));
    await user.click(screen.getByRole('button', { name: 'Șterge Chirie' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Ștergere categorie' });
    await user.type(within(dialog).getByLabelText('Scrie ȘTERGE pentru confirmare'), 'ȘTERGE');
    await user.click(within(dialog).getByRole('button', { name: 'Șterge definitiv' }));

    expect(await screen.findByText('Categorie ștearsă.')).toBeInTheDocument();
  });

  it('adaugă o cheltuială nouă din formular', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByText('+ Cheltuială nouă'));
    // Data implicită e `today()` — poate cădea în afara lunii vizualizate (2026-09) când testul
    // rulează chiar în ultima noapte a lunii; fixăm o dată din septembrie explicit.
    await user.clear(screen.getByLabelText('Data cheltuielii'));
    await user.type(screen.getByLabelText('Data cheltuielii'), '2026-09-15');
    await user.type(screen.getByLabelText('Suma'), '250');
    await user.type(screen.getByLabelText('Descriere'), 'Detergenți');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Cheltuială adăugată.')).toBeInTheDocument();
    expect(screen.getByText('Detergenți')).toBeInTheDocument();
  });

  it('categoria se alege dintr-un chip, nu dintr-un câmp de text (FM-2)', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByText('+ Cheltuială nouă'));
    const dialog = within(screen.getByRole('dialog'));
    const chip = dialog.getByRole('radio', { name: 'Chirie' });
    expect(chip).toHaveAttribute('aria-checked', 'false');

    await user.click(chip);
    expect(chip).toHaveAttribute('aria-checked', 'true');

    await user.type(screen.getByLabelText('Suma'), '80');
    await user.click(dialog.getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Cheltuială adăugată.')).toBeInTheDocument();
    expect(currentExpenses.at(-1)?.category).toBe('Chirie');
  });

  it('„Salvează și adaugă alta” salvează, golește suma și descrierea, Drawer-ul rămâne deschis (FM-2)', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByText('+ Cheltuială nouă'));
    await user.type(screen.getByLabelText('Suma'), '120');
    await user.type(screen.getByLabelText('Descriere'), 'Prima');
    await user.click(screen.getByRole('button', { name: 'Salvează și adaugă alta' }));

    expect(await screen.findByText('Cheltuială adăugată.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Adaugă: cheltuială' })).toBeInTheDocument(); // Drawer rămâne deschis
    expect(screen.getByLabelText('Suma')).toHaveValue(null);
    expect(screen.getByLabelText('Descriere')).toHaveValue('');
    expect(currentExpenses.some(e => e.description === 'Prima')).toBe(true);
  });

  it('?nou=1 în URL deschide direct formularul „Cheltuială nouă” (08-dashboard.md #3)', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage('/cheltuieli?nou=1');

    expect(await screen.findByLabelText('Suma')).toBeInTheDocument();
  });

  it('formularul de cheltuială devine „nesalvat” după prima modificare (13b)', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByText('+ Cheltuială nouă'));
    expect(readDirtyForms()).toEqual([]);

    await user.type(screen.getByLabelText('Suma'), '250');

    const [dirtyForm] = readDirtyForms();
    expect(dirtyForm.label).toBe('o cheltuială');
    await expect(dirtyForm.save()).resolves.toBe(true);
  });

  it('save() din formularul de cheltuială întoarce false când mutația pică (C1)', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByText('+ Cheltuială nouă'));
    await user.type(screen.getByLabelText('Suma'), '250');

    const [dirtyForm] = readDirtyForms();

    // Simulăm eșecul mutației (ex. 409 „Verifică operațiunea anterioară”) — înainte de C1,
    // ExpenseFormDrawer.submitForm întorcea true fără să aștepte deloc mutația, deci
    // „Salvează și schimbă” din useBranchSwitch ar fi schimbat filiala cu formularul pierdut.
    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Verifică operațiunea anterioară cu „Reîncarcă”.' }),
    }));

    await expect(dirtyForm.save()).resolves.toBe(false);
    // Formularul rămâne nesalvat — nu s-a închis, nu s-a golit registrul dirty-forms.
    expect(readDirtyForms()).toHaveLength(1);
    expect(await screen.findByText('Verifică operațiunea anterioară cu „Reîncarcă”.')).toBeInTheDocument();
  });

  it('a doua deschidere a formularului „Cheltuială nouă” e goală, nu precompletată cu prima (C2)', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByText('+ Cheltuială nouă'));
    await user.type(screen.getByLabelText('Suma'), '250');
    await user.type(screen.getByLabelText('Descriere'), 'Detergenți');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(await screen.findByText('Cheltuială adăugată.')).toBeInTheDocument();

    await user.click(screen.getByText('+ Cheltuială nouă'));

    expect((screen.getByLabelText('Suma') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Descriere') as HTMLInputElement).value).toBe('');
    expect(readDirtyForms()).toEqual([]);
  });

  it('dublu-clic rapid pe Salvează la o cheltuială nouă pornește o singură mutație (M12)', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByText('+ Cheltuială nouă'));
    await user.type(screen.getByLabelText('Suma'), '250');
    await user.type(screen.getByLabelText('Descriere'), 'Detergenți');

    let resolveRecord!: (value: unknown) => void;
    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveRecord = resolve;
        }),
    );

    const saveButton = screen.getByRole('button', { name: 'Salvează' });
    await user.click(saveButton);
    await user.click(saveButton);
    resolveRecord(
      jsonResponse({
        ...fixtureState,
        expenses: [
          ...fixtureState.expenses,
          {
            id: 'e4',
            date: '2026-09-20',
            category: 'General',
            description: 'Detergenți',
            amount: 250,
            archived: false,
          },
        ],
      }),
    );

    expect(await screen.findByText('Cheltuială adăugată.')).toBeInTheDocument();

    const recordCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([path]) => path === '/api/record');
    expect(recordCalls).toHaveLength(1);
  });

  it('editează o cheltuială existentă din meniul rândului', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    const row = screen.getByText('Salariu septembrie').closest('tr')!;
    await user.click(within(row).getByLabelText('Mai multe acțiuni'));
    await user.click(within(row).getByRole('button', { name: 'Editează' }));

    const amountInput = screen.getByLabelText('Suma') as HTMLInputElement;
    expect(amountInput.value).toBe('3000');
    await user.clear(amountInput);
    await user.type(amountInput, '3200');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Cheltuială actualizată.')).toBeInTheDocument();
  });

  it('ștergerea definitivă rămâne dezactivată pentru o cheltuială activă și funcționează pentru una arhivată', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    const activeRow = screen.getByText('Salariu septembrie').closest('tr')!;
    await user.click(within(activeRow).getByLabelText('Mai multe acțiuni'));
    expect(within(activeRow).getByRole('button', { name: 'Șterge definitiv' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Nearhivate/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Arhivate' }));
    const archivedRow = screen.getByText('Chirie sediu').closest('tr')!;
    await user.click(within(archivedRow).getByLabelText('Mai multe acțiuni'));
    await user.click(within(archivedRow).getByRole('button', { name: 'Șterge definitiv' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Ștergere definitivă' });
    await user.type(within(dialog).getByLabelText('Scrie ȘTERGE pentru confirmare'), 'ȘTERGE');
    await user.click(within(dialog).getByRole('button', { name: 'Șterge definitiv' }));

    expect(await screen.findByText('Cheltuială ștearsă definitiv.')).toBeInTheDocument();
  });

  it('B2: „Șterge definitiv” din bara de selecție șterge în lot cheltuielile arhivate selectate', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Nearhivate/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Arhivate' }));
    const row = screen.getByText('Chirie sediu').closest('tr')!;
    await user.click(within(row).getByRole('checkbox'));

    const selectionBar = screen.getByText(/1 selectate/).closest('div')!;
    await user.click(within(selectionBar).getByRole('button', { name: 'Șterge definitiv' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Ștergi definitiv 1 cheltuială?' });
    await user.type(within(dialog).getByLabelText('Scrie ȘTERGE pentru confirmare'), 'ȘTERGE');
    await user.click(within(dialog).getByRole('button', { name: 'Șterge 1 cheltuială' }));

    expect(await screen.findByText('1 cheltuială ștearsă definitiv.')).toBeInTheDocument();
    expect(screen.queryByText('Chirie sediu')).not.toBeInTheDocument();
  });

  it('comută pe vizualizarea „Pe zile” și grupează cheltuielile pe dată', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    await userEvent.click(screen.getByRole('radio', { name: 'Pe zile' }));

    expect(screen.getByText('Salariu septembrie')).toBeInTheDocument();
    expect(screen.getByText('Curent')).toBeInTheDocument();
  });
});
