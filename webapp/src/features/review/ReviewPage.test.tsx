import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { ReviewPage } from './ReviewPage';
import type { ViewKey } from '@shared/view-key';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [],
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

function renderPage(onNavigate: (view: ViewKey) => void = () => {}) {
  return render(
    <ToastProvider>
      <ReviewPage onNavigate={onNavigate} />
    </ToastProvider>,
  );
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

  it('arată un mesaj de încărcare înainte ca sesiunea să fie gata', () => {
    renderPage();
    expect(screen.getByText('Se încarcă datele…')).toBeInTheDocument();
  });

  it('arată achitarea fără copil ca observație', async () => {
    await loadedSession();
    renderPage();

    expect(screen.getByText('Import CSV')).toBeInTheDocument();
    expect(screen.getByText('Copil neasociat')).toBeInTheDocument();
  });

  it('„Corectează achitarea" navighează spre Achitări', async () => {
    await loadedSession();
    const onNavigate = vi.fn();
    renderPage(onNavigate);
    const user = userEvent.setup();

    await user.click(screen.getByText('Corectează achitarea'));
    expect(onNavigate).toHaveBeenCalledWith('payments');
  });

  it('resetarea filtrelor golește căutarea', async () => {
    await loadedSession();
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Caută'), 'ceva ce nu există');
    expect(screen.queryByText('Import CSV')).not.toBeInTheDocument();

    await user.click(screen.getByText('Resetează filtrele'));
    expect(screen.getByText('Import CSV')).toBeInTheDocument();
  });
});
