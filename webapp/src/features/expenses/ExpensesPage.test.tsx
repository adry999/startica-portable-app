import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { ExpensesPage } from './ExpensesPage';

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
  ],
  groups: [],
  categories: [{ id: 'cat1', name: 'Chirie' }],
  visits: [],
};

function renderPage() {
  return render(
    <ToastProvider>
      <ExpensesPage month="2026-09" />
    </ToastProvider>,
  );
}

describe('ExpensesPage', () => {
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
          if (body.type === 'expenses') {
            const updated = {
              ...fixtureState,
              expenses: fixtureState.expenses.map(e => (e.id === body.record.id ? body.record : e)),
            };
            return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
          }
          if (body.type === 'categories') {
            const updated = { ...fixtureState, categories: [...fixtureState.categories, body.record] };
            return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
          }
          throw new Error(`tip neașteptat: ${body.type}`);
        }
        if (path === '/api/category-delete') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const updated = { ...fixtureState, categories: fixtureState.categories.filter(c => c.id !== body.id) };
          return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată un mesaj de încărcare înainte ca sesiunea să fie gata', () => {
    renderPage();
    expect(screen.getByText('Se încarcă datele…')).toBeInTheDocument();
  });

  it('randează totalul lunii și cheltuielile active implicit, fără cele arhivate', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const totalCard = screen.getByText('Total lună').closest('div')!;
    expect(within(totalCard).getByText('3.450,00 lei')).toBeInTheDocument(); // 3000 + 450, active pe septembrie
    expect(screen.getByText('Salariu septembrie')).toBeInTheDocument();
    expect(screen.queryByText('Chirie sediu')).not.toBeInTheDocument(); // arhivată, filtrul implicit e „Activi”
  });

  it('caută după descriere', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    await userEvent.type(screen.getByLabelText('Caută cheltuială'), 'curent');

    expect(screen.getByText('Curent')).toBeInTheDocument();
    expect(screen.queryByText('Salariu septembrie')).not.toBeInTheDocument();
  });

  it('arhivează o cheltuială din meniul rândului', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    const row = screen.getByText('Curent').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Arhivează' }));

    await waitFor(() => expect(screen.queryByText('Curent')).not.toBeInTheDocument());
    const totalCard = screen.getByText('Total lună').closest('div')!;
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

  it('adaugă o categorie nouă din formularul de sub filtre', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());

    renderPage();
    await userEvent.type(screen.getByLabelText('Categoria nouă'), 'Reparații');
    await userEvent.click(screen.getByRole('button', { name: '+ Adaugă' }));

    expect(await screen.findByText('Categorie adăugată.')).toBeInTheDocument();
  });

  it('șterge o categorie după confirmare', async () => {
    const session = renderHook(() => useAppSession());
    await act(() => session.result.current.load());
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Șterge Chirie' }));

    expect(await screen.findByText('Categorie ștearsă.')).toBeInTheDocument();
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
