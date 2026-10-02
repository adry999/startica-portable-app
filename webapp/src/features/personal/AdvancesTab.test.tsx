import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { reloadPersonal } from '@shared/personal/usePersonal';
import { AdvancesTab } from './AdvancesTab';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixturePersonalState = {
  departments: [{ id: 'DEP-1', name: 'Educatori', order: 1 }],
  roles: [{ id: 'ROL-1', name: 'Educator', departmentId: 'DEP-1', order: 1 }],
  staff: [
    {
      id: 'STF-1',
      name: 'Ana Popescu',
      roleId: 'ROL-1',
      branchIds: ['bu'],
      phone: '',
      since: '2020-01-01',
      archivedAt: null,
      notes: [],
    },
  ],
  settings: { annualLeaveDays: 28, deductOnlyUnexcused: true },
};

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3', branch: null, branches: [] });
      if (path === '/api/state')
        return jsonResponse({
          state: { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] },
          revision: 1,
          updatedAt: '2026-09-23T10:00:00Z',
        });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/personal/state') return jsonResponse(fixturePersonalState);
      if (path.startsWith('/api/personal/advances'))
        return jsonResponse({
          advances: [
            {
              id: 'ADV-1',
              staffId: 'STF-1',
              date: '2026-09-05',
              amount: 500,
              method: 'Cash',
              month: '2026-09',
              deductedAt: '2026-09-30',
            },
            {
              id: 'ADV-2',
              staffId: 'STF-1',
              date: '2026-09-10',
              amount: 300,
              method: 'Cash',
              month: '2026-09',
              deductedAt: null,
            },
          ],
        });
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('AdvancesTab', () => {
  beforeEach(() => stubFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('avansul scăzut are starea Scăzut și nu se mai poate șterge', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <AdvancesTab />
      </ToastProvider>,
    );

    await screen.findByText('Scăzut');
    expect(screen.getByText('Scăzut')).toBeInTheDocument();
    expect(screen.getByText('De scăzut')).toBeInTheDocument();

    // §13.1: cele mai noi primele — ADV-2 (10 sep., nescăzut) înaintea ADV-1 (5 sep., scăzut).
    const removeButtons = screen.getAllByRole('button', { name: 'Șterge' });
    expect(removeButtons).toHaveLength(2);
    expect(removeButtons[0]).not.toBeDisabled();
    expect(removeButtons[1]).toBeDisabled();
  });
});
