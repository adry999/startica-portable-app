import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider, TopbarActionsProvider, useTopbarActionsSlot } from '@shared/ui';
import { ReviewPage } from './ReviewPage';

/** Randează slot-ul de antet ca Topbar-ul real — comutatorul Toate/Fișe/Achitări ajunge acolo (R-1). */
function TopbarActionsSlot() {
  return <>{useTopbarActionsSlot()}</>;
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

// c1: fișă fără taxă și fără grupă (categoria "children"); p1: achitare fără copil (categoria "unassigned").
const fixtureState = {
  children: [
    {
      id: 'c1',
      name: 'Ana Popescu',
      contractNumber: '5',
      birthDate: '2022-01-01',
      dueDay: 10,
      attendanceDate: '2026-01-10',
      groupId: null,
      status: 'Activ',
      statusHistory: [],
      feeHistory: [],
      fee: null,
      archived: false,
    },
  ],
  payments: [
    {
      id: 'p1',
      date: '2026-09-10',
      childId: '',
      sourceName: 'Import CSV',
      amount: 500,
      method: 'Cash',
      tenders: [{ method: 'Cash', amount: 500 }],
      allocations: [{ month: '2026-09', amount: 500 }],
      archived: false,
    },
  ],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
};

function renderPage() {
  const onNavigate = vi.fn();
  render(
    <MemoryRouter initialEntries={['/de-verificat']}>
      <ToastProvider>
        <TopbarActionsProvider>
          <TopbarActionsSlot />
          <Routes>
            <Route path="/de-verificat" element={<ReviewPage onNavigate={onNavigate} />} />
            <Route path="/copii/:id" element={<div>PAGINA FIȘEI</div>} />
            <Route path="/achitari/:id" element={<div>PAGINA ACHITĂRII</div>} />
          </Routes>
        </TopbarActionsProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
  return { onNavigate };
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('ReviewPage', () => {
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
            payments: [{ ...fixtureState.payments[0], reviewed: body.record.reviewed }],
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

  it('arată coada cu fișe și achitări, cu numărul din antet', async () => {
    await loadedSession();
    renderPage();

    expect(screen.getByText('Toate · 2')).toBeInTheDocument();
    expect(screen.getByText('Fișe · 1')).toBeInTheDocument();
    expect(screen.getByText('Achitări · 1')).toBeInTheDocument();
    expect(screen.getByText('Ana Popescu')).toBeInTheDocument();
    // „Import CSV” e activ implicit (cel mai sever) — apare atât în coadă, cât și în panoul de caz.
    expect(screen.getAllByText('Import CSV').length).toBeGreaterThan(0);
  });

  it('„Deschide fișa" navighează spre fișa copilului, nu spre lista generică', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    // Primul caz din coadă (cel mai sever) e „Import CSV” — comută pe fișa Anei.
    await user.click(screen.getByText('Ana Popescu'));
    await user.click(screen.getByText('Deschide fișa →'));

    expect(screen.getByText('PAGINA FIȘEI')).toBeInTheDocument();
  });

  it('„Corectează achitarea" navighează spre achitarea respectivă, nu spre lista generică', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByText('Corectează achitarea'));
    expect(screen.getByText('PAGINA ACHITĂRII')).toBeInTheDocument();
  });

  it('tasta S trece la cazul următor', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    expect(screen.getByText('1 din 2')).toBeInTheDocument();
    await user.keyboard('s');
    expect(screen.getByText('2 din 2')).toBeInTheDocument();
  });

  it('căutarea filtrează coada', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Caută'), 'Ana');
    expect(screen.queryByText('Import CSV')).not.toBeInTheDocument();
    expect(screen.getAllByText('Ana Popescu').length).toBeGreaterThan(0);
  });
});
