import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { NotifyPage } from './NotifyPage';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [
    {
      id: 'c1',
      name: 'Andrei Popescu',
      parent: 'Maria Popescu',
      phone: '0722000000',
      contractDate: '2026-01-05',
      attendanceDate: '2026-01-05',
      status: 'Activ',
      statusHistory: [],
      feeHistory: [{ from: '2026-01', amount: 1500 }],
      groupId: null,
      archived: false,
    },
  ],
  payments: [],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
};

function renderPage() {
  return render(
    <ToastProvider>
      <NotifyPage month="2026-09" onNavigate={() => {}} />
    </ToastProvider>,
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('NotifyPage', () => {
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
    localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arată un mesaj de încărcare înainte ca sesiunea să fie gata', () => {
    renderPage();
    expect(screen.getByText('Se încarcă datele…')).toBeInTheDocument();
  });

  it('arată copilul restanțier și contactul lui', async () => {
    await loadedSession();
    renderPage();

    expect(await screen.findByText('Andrei Popescu')).toBeInTheDocument();
    expect(screen.getByText('Maria Popescu')).toBeInTheDocument();
  });

  it('"Copiază toate mesajele" copiază în clipboard și arată un toast', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Andrei Popescu');
    await user.click(screen.getByText('Copiază toate mesajele'));

    expect(await screen.findByText('1 mesaje copiate.')).toBeInTheDocument();
  });
});
