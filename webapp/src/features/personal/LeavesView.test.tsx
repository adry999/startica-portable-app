import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { reloadPersonal } from '@shared/personal/usePersonal';
import { LeavesView } from './LeavesView';

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
    {
      id: 'STF-2',
      name: 'Bogdan Rusu',
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
          state: {
            children: [],
            payments: [],
            expenses: [],
            groups: [{ id: 'GRP-1', name: 'Mars', capacity: null }],
            categories: [],
            visits: [],
          },
          revision: 1,
          updatedAt: '2026-09-23T10:00:00Z',
        });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/personal/state') return jsonResponse(fixturePersonalState);
      if (path.startsWith('/api/personal/leaves'))
        return jsonResponse({
          leaves: [
            { id: 'LV-1', staffId: 'STF-1', from: '2026-07-06', to: '2026-07-27', type: 'CO', planned: false },
            { id: 'LV-2', staffId: 'STF-2', from: '2026-07-20', to: '2026-08-01', type: 'CO', planned: false },
          ],
          warnings: [{ groupId: 'GRP-1', staffIds: ['STF-1', 'STF-2'], from: '2026-07-20', to: '2026-07-27' }],
        });
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('LeavesView', () => {
  beforeEach(() => stubFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('două concedii suprapuse în aceeași grupă arată avertizarea', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <LeavesView />
      </ToastProvider>,
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText(/Ana Popescu și Bogdan Rusu \(Mars\) au concediu suprapus 20–27 iulie\./),
    ).toBeInTheDocument();
  });

  it('bara unui concediu e poziționată pe zilele lui, nu pe toată luna', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <LeavesView />
      </ToastProvider>,
    );

    const bar = await screen.findByTitle('Ana Popescu: 6–27 iulie');
    expect(bar).toHaveStyle({ left: `${((187 - 1) / 365) * 100}%`, width: `${(22 / 365) * 100}%` });
  });

  it('clic pe o bară deschide formularul în editare, cu opțiunea de ștergere', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <LeavesView />
      </ToastProvider>,
    );

    const bar = await screen.findByTitle('Ana Popescu: 6–27 iulie');
    act(() => fireEvent.click(bar));

    expect(screen.getByText('Editează: concediu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Șterge' })).toBeInTheDocument();
  });
});
