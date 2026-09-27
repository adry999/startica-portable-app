import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { reloadPersonal } from '@shared/personal/usePersonal';
import { StaffFormDrawer } from './StaffFormDrawer';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixturePersonalState = {
  departments: [{ id: 'DEP-1', name: 'Educatori', order: 1 }],
  roles: [{ id: 'ROL-1', name: 'Educator', departmentId: 'DEP-1', order: 1 }],
  staff: [],
  settings: { annualLeaveDays: 28, deductOnlyUnexcused: true },
};

let savedStaffCalls: unknown[] = [];

function stubFetch() {
  savedStaffCalls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, options?: RequestInit) => {
      if (path === '/api/session')
        return jsonResponse({
          token: 'tok',
          version: '1.6.3',
          branch: { id: 'bu', name: 'Buiucani', color: '' },
          branches: [{ id: 'bu', name: 'Buiucani', color: '' }],
        });
      if (path === '/api/state')
        return jsonResponse({
          state: { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] },
          revision: 1,
          updatedAt: '2026-09-23T10:00:00Z',
        });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/personal/state') return jsonResponse(fixturePersonalState);
      if (path === '/api/personal/staff') {
        savedStaffCalls.push(JSON.parse(String(options?.body)));
        return jsonResponse({ staff: JSON.parse(String(options?.body)).staff });
      }
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('StaffFormDrawer', () => {
  beforeEach(() => stubFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('cere cel puțin o filială înainte de a salva un angajat nou', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <StaffFormDrawer target="new" onClose={() => {}} />
      </ToastProvider>,
    );

    await userEvent.type(screen.getByLabelText('Nume angajat'), 'Maria Ionescu');
    await userEvent.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Alege cel puțin o filială.')).toBeInTheDocument();
    expect(savedStaffCalls).toHaveLength(0);
  });

  it('salvează un angajat nou cu funcția și filiala alese', async () => {
    await loadedSession();
    await act(() => reloadPersonal());
    const onClose = vi.fn();

    render(
      <ToastProvider>
        <StaffFormDrawer target="new" onClose={onClose} />
      </ToastProvider>,
    );

    await userEvent.type(screen.getByLabelText('Nume angajat'), 'Maria Ionescu');
    await userEvent.click(screen.getByRole('button', { name: 'Buiucani' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(await screen.findByText('Angajat adăugat.')).toBeInTheDocument();
    expect(savedStaffCalls).toHaveLength(1);
    expect((savedStaffCalls[0] as { staff: { name: string; branchIds: string[] } }).staff).toMatchObject({
      name: 'Maria Ionescu',
      branchIds: ['bu'],
    });
    expect(onClose).toHaveBeenCalled();
  });
});
