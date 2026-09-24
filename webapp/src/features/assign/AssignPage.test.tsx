import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { AssignPage } from './AssignPage';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [{ id: 'c1', name: 'Andrei Popescu', groupId: null, archived: false, feeHistory: [] }],
  payments: [
    {
      id: 'p1',
      date: '2026-09-10',
      childId: '',
      sourceName: 'Andrei P.',
      amount: 1500,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 1500 }],
      allocations: [{ month: '2026-09', amount: 1500 }],
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
      <AssignPage month="2026-09" />
    </ToastProvider>,
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('AssignPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/payments-assign') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const assigned = body.assignments[0];
          const updated = {
            ...fixtureState,
            payments: [{ ...fixtureState.payments[0], childId: assigned.childId }],
          };
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

  it('arată achitarea neasociată și riscul', async () => {
    await loadedSession();
    renderPage();

    expect(screen.getByText('Andrei P.')).toBeInTheDocument();
    expect(screen.getByText('nu se scad din datoria nimănui')).toBeInTheDocument();
  });

  it('"Completează cu prima sugestie" alege copilul potrivit după nume', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByText('Completează cu prima sugestie'));

    const select = screen.getByLabelText(/Copil pentru achitarea din/) as HTMLSelectElement;
    expect(select.value).toBe('c1');
  });

  it('salvarea asocierilor arată un toast de confirmare', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByText('Completează cu prima sugestie'));
    await user.click(screen.getByText(/Salvează asocierile/));

    expect(await screen.findByText('1 achitări asociate.')).toBeInTheDocument();
  });
});
