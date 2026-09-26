import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { formatMonthLabel } from '#shared/format/date-format.mjs';
import { AssignPage } from './AssignPage';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// c1 potrivește unic pe nume (p1 -> c1); p2 n-are text de sursă, dar suma
// achitată se potrivește exact cu taxa lunară a lui c2 — sugestie „doar sumă”,
// fără nameMatch; p3 are „Maria” în sursă, ambiguu între c2 și c3.
const fixtureState = {
  children: [
    { id: 'c1', name: 'Andrei Popescu', groupId: null, archived: false, feeHistory: [] },
    { id: 'c2', name: 'Maria Ionescu', groupId: null, archived: false, feeHistory: [{ from: '2026-01', amount: 300 }] },
    { id: 'c3', name: 'Maria Dinescu', groupId: null, archived: false, feeHistory: [] },
  ],
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
    {
      id: 'p2',
      date: '2026-09-05',
      childId: '',
      sourceName: '',
      amount: 300,
      method: 'Card',
      tenders: [{ method: 'Card', amount: 300 }],
      allocations: [{ month: '2026-09', amount: 300 }],
      archived: false,
    },
    {
      id: 'p3',
      date: '2026-09-01',
      childId: '',
      sourceName: 'Maria',
      amount: 500,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 500 }],
      allocations: [],
      archived: false,
    },
  ],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
};

const EMPTY_QUEUE_STATE = {
  ...fixtureState,
  payments: fixtureState.payments.map(payment => ({ ...payment, childId: 'c1' })),
};

function stubFetch(state: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
      if (path === '/api/state') return jsonResponse({ state, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/payments-assign') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const byId = new Map(body.assignments.map((a: { id: string; childId: string }) => [a.id, a.childId]));
        const current = state as typeof fixtureState;
        const updated = {
          ...current,
          payments: current.payments.map(payment =>
            byId.has(payment.id) ? { ...payment, childId: byId.get(payment.id) } : payment,
          ),
        };
        return jsonResponse({ state: updated, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
      }
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

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
    stubFetch(fixtureState);
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

    const selects = screen.getAllByLabelText(/Copil pentru achitarea din/) as HTMLSelectElement[];
    const p1Select = selects.find(select => select.value === 'c1');
    expect(p1Select).toBeTruthy();
  });

  it('salvarea asocierilor arată un toast de confirmare', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByText('Completează cu prima sugestie'));
    await user.click(screen.getByText(/Salvează asocierile/));

    expect(await screen.findByText('1 achitări asociate.')).toBeInTheDocument();
  });

  it('arată grupurile de opțiuni relevante, inclusiv cel ambiguu', async () => {
    await loadedSession();
    const { container } = renderPage();

    const labels = Array.from(container.querySelectorAll('optgroup')).map(el => el.getAttribute('label'));
    expect(labels).toEqual(
      expect.arrayContaining(['Nume potrivit în sursă', 'Toți copiii', 'Doar sumă sau lună — verifică']),
    );
  });

  it('arată mesajul de coadă goală când nu există achitări neasociate', async () => {
    stubFetch(EMPTY_QUEUE_STATE);
    await loadedSession();
    renderPage();

    expect(screen.getByText('Nu există achitări neasociate.')).toBeInTheDocument();
  });

  it('arată luna formatată, nu cheia brută, în cardul de risc', async () => {
    await loadedSession();
    renderPage();

    expect(screen.queryByText('Din care pe luna 2026-09')).not.toBeInTheDocument();
    expect(screen.getByText(`Din care pe luna ${formatMonthLabel('2026-09')}`)).toBeInTheDocument();
  });
});
