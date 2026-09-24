import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { FeeSetupPage } from './FeeSetupPage';

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
    <ToastProvider>
      <FeeSetupPage />
    </ToastProvider>,
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

  it('arată un mesaj de încărcare înainte ca sesiunea să fie gata', () => {
    renderPage();
    expect(screen.getByText('Se încarcă datele…')).toBeInTheDocument();
  });

  it('arată copilul fără taxă și numărul din antet', async () => {
    await loadedSession();
    renderPage();

    expect(screen.getByText('Andrei Popescu')).toBeInTheDocument();
    expect(screen.getByText(/1 copii fără taxă completată/)).toBeInTheDocument();
  });

  it('completarea taxei arată bara de salvare, iar salvarea o ascunde', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    const feeInput = screen.getByLabelText('Taxă lunară pentru Andrei Popescu');
    await user.type(feeInput, '1500');
    expect(screen.getByText('Ai completări nesalvate.')).toBeInTheDocument();

    await user.click(screen.getByText('Salvează completările'));
    expect(await screen.findByText(/fișe completate/)).toBeInTheDocument();
  });
});
