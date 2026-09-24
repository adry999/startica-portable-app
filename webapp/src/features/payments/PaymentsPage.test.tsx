import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { PaymentsPage } from './PaymentsPage';

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

function renderPage() {
  return render(
    <ToastProvider>
      <PaymentsPage />
    </ToastProvider>,
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('PaymentsPage', () => {
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
            payments:
              body.mode === 'create'
                ? [...fixtureState.payments, body.record]
                : fixtureState.payments.map(p => (p.id === body.record.id ? body.record : p)),
          };
          return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        }
        if (path === '/api/record-delete') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const updated = { ...fixtureState, payments: fixtureState.payments.filter(p => p.id !== body.id) };
          return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
        }
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

  it('randează rândurile din tabel cu sumarul pe metodă', async () => {
    await loadedSession();
    renderPage();

    expect(screen.getByText('Total filtrat')).toBeInTheDocument();
    expect(screen.getAllByText('Andrei Popescu').length).toBeGreaterThan(0);
    expect(screen.getByText('Import CSV')).toBeInTheDocument();
    expect(screen.getByText('Neasociată')).toBeInTheDocument();
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

    const archiveButtons = screen.getAllByRole('button', { name: 'Arhivează' });
    await userEvent.click(archiveButtons[0]);

    expect(await screen.findByText('Achitare arhivată.')).toBeInTheDocument();
  });

  it('comută pe vizualizarea "Pe luni" și arată gruparea cu subtotal', async () => {
    await loadedSession();
    renderPage();

    await userEvent.click(screen.getByRole('radio', { name: 'Pe luni' }));

    expect(screen.getAllByText(/^2026 Sep/).length).toBeGreaterThan(0);
  });

  it('adaugă o achitare nouă din formular', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '+ Achitare nouă' }));
    const dialog = screen.getByRole('dialog', { name: 'Adaugă: achitare' });

    await user.selectOptions(within(dialog).getByLabelText('Copil'), 'c2');
    await user.type(within(dialog).getByLabelText('Cash'), '600');
    await user.click(within(dialog).getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Achitare adăugată.')).toBeInTheDocument();
  });

  it('editează o achitare existentă din meniul rândului', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    const table = screen.getByRole('table');
    const row = within(table).getByText('Andrei Popescu').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Editează' }));

    const dialog = screen.getByRole('dialog', { name: 'Editează: achitare' });
    const cashInput = within(dialog).getByLabelText('Cash') as HTMLInputElement;
    expect(cashInput.value).toBe('1500');
    await user.clear(cashInput);
    await user.type(cashInput, '1600');
    await user.click(within(dialog).getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Achitare actualizată.')).toBeInTheDocument();
  });

  it('ștergerea definitivă rămâne dezactivată pentru o achitare activă', async () => {
    await loadedSession();
    renderPage();

    const table = screen.getByRole('table');
    const row = within(table).getByText('Andrei Popescu').closest('tr')!;
    expect(within(row).getByRole('button', { name: 'Șterge' })).toBeDisabled();
  });
});
