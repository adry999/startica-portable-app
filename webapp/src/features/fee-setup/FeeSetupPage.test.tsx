import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider, TopbarActionsProvider, useTopbarActionsSlot } from '@shared/ui';
import { FeeSetupPage } from './FeeSetupPage';

/** Randează slot-ul de antet ca Topbar-ul real — progresul ajunge acolo, nu în corpul paginii (F-1). */
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
      contractNumber: '10',
      attendanceDate: '2026-01-10',
      birthDate: '2022-01-10',
      dueDay: 26,
      groupId: null,
      status: 'Activ',
      statusHistory: [],
      feeHistory: [],
      fee: null,
      archived: false,
    },
  ],
  payments: [],
  expenses: [],
  groups: [{ id: 'g1', name: 'Fluturași', capacity: 20 }],
  categories: [],
  visits: [],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TopbarActionsProvider>
          <TopbarActionsSlot />
          <FeeSetupPage />
        </TopbarActionsProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('FeeSetupPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path === '/api/children-setup') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const update = body.updates[0];
          const updated = {
            ...fixtureState,
            children: [
              { ...fixtureState.children[0], fee: update.fee, feeHistory: [{ from: update.from, amount: update.fee }] },
            ],
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

  it('arată copilul fără taxă și progresul în antet', async () => {
    await loadedSession();
    renderPage();

    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();
    expect(screen.getByText('0 din 1 completate')).toBeInTheDocument();
    expect(screen.getByText('1 rămase')).toBeInTheDocument();
  });

  it('paginează — nu arată toate rândurile deodată (audit 03.10)', async () => {
    const manyChildren = Array.from({ length: 25 }, (_, index) => ({
      id: `c${index}`,
      name: `Copil ${index}`,
      contractNumber: String(index),
      attendanceDate: '2026-01-10',
      birthDate: '2022-01-10',
      dueDay: 26,
      groupId: null,
      status: 'Activ',
      statusHistory: [],
      feeHistory: [],
      fee: null,
      archived: false,
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({
            state: { ...fixtureState, children: manyChildren },
            revision: 1,
            updatedAt: '2026-09-23T10:00:00Z',
          });
        if (path === '/api/health') return jsonResponse({});
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    await loadedSession();
    renderPage();

    expect(screen.getAllByText(/Copil \d+/).length).toBe(10);
    expect(screen.getByText('1–10 din 25')).toBeInTheDocument();
  });

  it('completarea taxei activează Salvează pe rând, iar salvarea o dezactivează', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    const feeInput = screen.getByLabelText('Taxă lunară pentru Andrei Popescu');
    await user.type(feeInput, '1500');
    const saveButton = screen.getByRole('button', { name: 'Salvează' });
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);
    expect(await screen.findByText(/fișă completată/)).toBeInTheDocument();
  });
});
