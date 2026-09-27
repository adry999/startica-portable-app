import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { reloadPersonal } from '@shared/personal/usePersonal';
import { RolesDrawer } from './RolesDrawer';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixturePersonalState = {
  departments: [{ id: 'DEP-1', name: 'Educatori', order: 1 }],
  roles: [
    { id: 'ROL-1', name: 'Educator', departmentId: 'DEP-1', order: 1 },
    { id: 'ROL-2', name: 'Asistent educator', departmentId: 'DEP-1', order: 2 },
  ],
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
      if (path === '/api/session')
        return jsonResponse({ token: 'tok', version: '1.6.3', branch: null, branches: [] });
      if (path === '/api/state')
        return jsonResponse({
          state: { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] },
          revision: 1,
          updatedAt: '2026-09-23T10:00:00Z',
        });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/personal/state') return jsonResponse(fixturePersonalState);
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('RolesDrawer', () => {
  beforeEach(() => stubFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('o funcție cu angajați nu are buton de ștergere activ', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <RolesDrawer open onClose={() => {}} />
      </ToastProvider>,
    );

    const educatorRow = (await screen.findByDisplayValue('Educator')).closest('li')!;
    const removeButton = educatorRow.querySelector('button')!;
    expect(removeButton).toBeDisabled();

    const asistentRow = screen.getByDisplayValue('Asistent educator').closest('li')!;
    const asistentRemove = asistentRow.querySelector('button')!;
    expect(asistentRemove).not.toBeDisabled();
  });
});
