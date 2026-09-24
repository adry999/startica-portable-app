import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useExpenses } from './useExpenses';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// Fixtură: cheltuieli active în trei categorii (Salarii, Utilități, Chirie —
// „Chirie” nu e în cele 5 culori din spec, deci cade la „Altele”), una din altă
// lună (august, exclusă din totalul lunii) și una arhivată (exclusă din total).
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
      date: '2026-08-20',
      category: 'Materiale educaționale',
      description: 'Jucării',
      amount: 200,
      archived: false,
    },
    {
      id: 'e4',
      date: '2026-09-15',
      category: 'Chirie',
      description: 'Chirie septembrie',
      amount: 1000,
      archived: false,
    },
    {
      id: 'e5',
      date: '2026-09-01',
      category: 'Salarii',
      description: 'Bonus',
      amount: 500,
      archived: true,
      archivedAt: '2026-09-02T00:00:00.000Z',
    },
  ],
  groups: [],
  categories: [
    { id: 'cat1', name: 'Chirie' },
    { id: 'cat2', name: 'Salarii' },
  ],
  visits: [],
};

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  return session;
}

describe('useExpenses', () => {
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('e loading înainte ca sesiunea să fie gata', () => {
    const { result } = renderHook(() => useExpenses('2026-09'));
    expect(result.current.status).toBe('loading');
  });

  it('calculează totalul lunii, excluzând cheltuielile arhivate și din alte luni', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExpenses('2026-09'));

    expect(result.current.status).toBe('ready');
    expect(result.current.monthTotal).toBe(4450); // 3000 + 450 + 1000
    expect(result.current.expenses).toHaveLength(5);
  });

  it('repartizează cheltuielile lunii pe categorii, cu categoriile necunoscute la „Altele”', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExpenses('2026-09'));

    const byLabel = Object.fromEntries(result.current.categorySummary.map(item => [item.label, item.amount]));
    expect(byLabel.Salarii).toBe(3000);
    expect(byLabel['Utilități']).toBe(450);
    expect(byLabel['Alimentație']).toBe(0);
    expect(byLabel['Materiale']).toBe(0);
    expect(byLabel['Întreținere']).toBe(0);
    expect(byLabel['Altele']).toBe(1000); // Chirie
  });

  it('listează categoriile persistate sortate alfabetic', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExpenses('2026-09'));

    expect(result.current.categories.map(category => category.name)).toEqual(['Chirie', 'Salarii']);
  });

  it('createCategory trimite mutația de creare cu id CAT- generat', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExpenses('2026-09'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.type).toBe('categories');
      expect(body.mode).toBe('create');
      expect(body.record.name).toBe('Reparații');
      expect(body.record.id).toMatch(/^CAT-/);
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.createCategory('Reparații'));
  });

  it('createCategory respinge un nume gol fără să trimită cererea', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExpenses('2026-09'));

    await expect(result.current.createCategory('   ')).rejects.toThrow('Completează numele categoriei.');
  });

  it('createCategory respinge o categorie existentă, chiar scrisă fără diacritice', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExpenses('2026-09'));

    await expect(result.current.createCategory('chirie')).rejects.toThrow('Categoria există deja.');
  });

  it('deleteCategory cheamă /api/category-delete cu id-ul categoriei', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExpenses('2026-09'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string, options: RequestInit) => {
      expect(path).toBe('/api/category-delete');
      const body = JSON.parse(options.body as string);
      expect(body.id).toBe('cat1');
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.deleteCategory('cat1'));
  });

  it('setExpenseArchived arhivează cu archivedAt setat și dezarhivează cu archivedAt null', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExpenses('2026-09'));
    const expense = result.current.expenses.find(e => e.id === 'e1')!;

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.type).toBe('expenses');
      expect(body.record.id).toBe('e1');
      expect(body.record.archived).toBe(true);
      expect(body.record.archivedAt).toBeTruthy();
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });
    await act(() => result.current.setExpenseArchived(expense, true));

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.record.archived).toBe(false);
      expect(body.record.archivedAt).toBeNull();
      return jsonResponse({ state: fixtureState, revision: 3, updatedAt: '2026-09-23T10:06:00Z' });
    });
    await act(() => result.current.setExpenseArchived(expense, false));
  });

  it('createExpense trimite un id EXP- generat și categoria canonicalizată', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExpenses('2026-09'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string, options: RequestInit) => {
      expect(path).toBe('/api/record');
      const body = JSON.parse(options.body as string);
      expect(body.type).toBe('expenses');
      expect(body.mode).toBe('create');
      expect(body.record.id).toMatch(/^EXP-/);
      expect(body.record.amount).toBe(120);
      expect(body.record.category).toBe('Chirie'); // "chirie" fără diacritice se potrivește cu categoria existentă
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() =>
      result.current.createExpense({
        date: '2026-09-20',
        amount: '120',
        category: 'chirie',
        description: 'Reparație robinet',
        notes: '',
      }),
    );
  });

  it('updateExpense păstrează id-ul existent și trimite mode "update"', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExpenses('2026-09'));
    const expense = result.current.expenses.find(e => e.id === 'e2')!;

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string, options: RequestInit) => {
      expect(path).toBe('/api/record');
      const body = JSON.parse(options.body as string);
      expect(body.mode).toBe('update');
      expect(body.record.id).toBe('e2');
      expect(body.record.amount).toBe(500);
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() =>
      result.current.updateExpense(expense, {
        date: expense.date,
        amount: '500',
        category: expense.category,
        description: expense.description,
        notes: '',
      }),
    );
  });

  it('createExpense cu sumă invalidă respinge fără să trimită cererea', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExpenses('2026-09'));

    await expect(
      result.current.createExpense({ date: '2026-09-20', amount: '0', category: 'Altele', description: '', notes: '' }),
    ).rejects.toThrow();
  });

  it('deleteExpense cheamă /api/record-delete cu tipul și id-ul', async () => {
    await loadedSession();
    const { result } = renderHook(() => useExpenses('2026-09'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (path: string, options: RequestInit) => {
      expect(path).toBe('/api/record-delete');
      const body = JSON.parse(options.body as string);
      expect(body.type).toBe('expenses');
      expect(body.id).toBe('e5');
      return jsonResponse({ state: fixtureState, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.deleteExpense('e5'));
  });
});
