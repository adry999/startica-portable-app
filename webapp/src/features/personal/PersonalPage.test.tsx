import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider, TopbarActionsProvider, useTopbarActionsSlot } from '@shared/ui';
import { reloadPersonal } from '@shared/personal/usePersonal';
import { PersonalPage } from './PersonalPage';

function TopbarActionsSlot() {
  return <div data-testid="topbar-slot">{useTopbarActionsSlot()}</div>;
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixturePersonalState = {
  departments: [{ id: 'DEP-1', name: 'Educatori', order: 1 }],
  roles: [{ id: 'ROL-1', name: 'Educator', departmentId: 'DEP-1', order: 1 }],
  staff: [
    { id: 'STF-1', name: 'Ana Popescu', roleId: 'ROL-1', branchIds: ['bu'], phone: '', since: '2020-01-01', archivedAt: null, notes: [] },
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
      if (path.startsWith('/api/personal/timesheet')) return jsonResponse({ rows: [] });
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('PersonalPage', () => {
  beforeEach(() => stubFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('implicit arată fila Echipa, cu comutatorul de file în antet', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <TopbarActionsProvider>
          <TopbarActionsSlot />
          <MemoryRouter>
            <PersonalPage month="2026-09" />
          </MemoryRouter>
        </TopbarActionsProvider>
      </ToastProvider>,
    );

    expect(screen.getByRole('radio', { name: 'Echipa' })).toBeInTheDocument();
    expect(await screen.findByText('Ana Popescu')).toBeInTheDocument();
  });

  it('„+ Angajat” stă în antet la fila Echipa, nu în corpul paginii', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <TopbarActionsProvider>
          <TopbarActionsSlot />
          <MemoryRouter>
            <PersonalPage month="2026-09" />
          </MemoryRouter>
        </TopbarActionsProvider>
      </ToastProvider>,
    );

    await screen.findByText('Ana Popescu');
    const topbarSlot = screen.getByTestId('topbar-slot');
    expect(within(topbarSlot).getByRole('button', { name: '+ Angajat' })).toBeInTheDocument();

    await userEvent.click(within(topbarSlot).getByRole('button', { name: '+ Angajat' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('la fila Pontaj, luna și „Tipărește” stau în antet, nu în corpul paginii', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <TopbarActionsProvider>
          <TopbarActionsSlot />
          <MemoryRouter>
            <PersonalPage month="2026-09" />
          </MemoryRouter>
        </TopbarActionsProvider>
      </ToastProvider>,
    );

    const topbarSlot = screen.getByTestId('topbar-slot');
    await userEvent.click(within(topbarSlot).getByRole('radio', { name: 'Pontaj' }));

    await screen.findByText('Ana Popescu');
    // Comutatorul de file rămâne în antet — un singur apel useTopbarActions, nu unul rescris de Pontaj.
    expect(within(topbarSlot).getByRole('radio', { name: 'Pontaj' })).toBeInTheDocument();
    expect(within(topbarSlot).getByText(/2026/)).toBeInTheDocument();
    expect(within(topbarSlot).getByRole('button', { name: 'Tipărește' })).toBeInTheDocument();
    // Un singur buton „Tipărește” în tot documentul — nu unul dublat în corpul paginii.
    expect(screen.getAllByRole('button', { name: 'Tipărește' })).toHaveLength(1);
  });
});
