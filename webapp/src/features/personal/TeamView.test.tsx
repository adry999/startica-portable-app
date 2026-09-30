import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { reloadPersonal } from '@shared/personal/usePersonal';
import { TeamView } from './TeamView';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureAppState = {
  children: [],
  payments: [],
  expenses: [],
  groups: [{ id: 'GRP-1', name: 'Fluturași', capacity: 10, team: [{ staffId: 'STF-1', role: 'principal' }] }],
  categories: [],
  visits: [],
};

const fixturePersonalState = {
  departments: [
    { id: 'DEP-1', name: 'Educatori', order: 1 },
    { id: 'DEP-2', name: 'Bucătărie', order: 2 },
  ],
  roles: [
    { id: 'ROL-1', name: 'Educator', departmentId: 'DEP-1', order: 1 },
    { id: 'ROL-2', name: 'Bucătar', departmentId: 'DEP-2', order: 1 },
  ],
  staff: [
    {
      id: 'STF-1',
      name: 'Ana Popescu',
      roleId: 'ROL-1',
      branchIds: ['bu', 'bo'],
      phone: '069000000',
      since: '2020-01-01',
      archivedAt: null,
      notes: [],
    },
    {
      id: 'STF-2',
      name: 'Bogdan Rusu',
      roleId: 'ROL-2',
      branchIds: ['bu'],
      phone: '',
      since: '2021-01-01',
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
      if (path === '/api/session')
        return jsonResponse({
          token: 'tok',
          version: '1.6.3',
          branch: { id: 'bu', name: 'Buiucani', color: '' },
          branches: [
            { id: 'bu', name: 'Buiucani', color: '' },
            { id: 'bo', name: 'Botanica', color: '' },
          ],
        });
      if (path === '/api/state')
        return jsonResponse({ state: fixtureAppState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
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

describe('TeamView', () => {
  beforeEach(() => {
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('echipa e grupată pe departamente și filtrează cu pastilele', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <TeamView onOpenStaff={() => {}} staffFormTarget={null} onCloseStaffForm={() => {}} onAddStaff={() => {}} />
      </ToastProvider>,
    );

    expect(await screen.findByText('Ana Popescu')).toBeInTheDocument();
    expect(screen.getByText('Bogdan Rusu')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Educatori' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Bucătărie' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Bucătărie' }));
    expect(screen.queryByText('Ana Popescu')).not.toBeInTheDocument();
    expect(screen.getByText('Bogdan Rusu')).toBeInTheDocument();
  });

  it('un angajat cu ambele filiale poartă eticheta', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <TeamView onOpenStaff={() => {}} staffFormTarget={null} onCloseStaffForm={() => {}} onAddStaff={() => {}} />
      </ToastProvider>,
    );

    await screen.findByText('Ana Popescu');
    expect(screen.getByText(/ambele filiale/)).toBeInTheDocument();
  });

  it('clic pe un rând deschide fișa angajatului', async () => {
    await loadedSession();
    await act(() => reloadPersonal());
    const onOpenStaff = vi.fn();

    render(
      <ToastProvider>
        <TeamView onOpenStaff={onOpenStaff} staffFormTarget={null} onCloseStaffForm={() => {}} onAddStaff={() => {}} />
      </ToastProvider>,
    );

    await userEvent.click(await screen.findByText('Ana Popescu'));
    expect(onOpenStaff).toHaveBeenCalledWith('STF-1');
  });
});
