import { act, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { reloadPersonal } from '@shared/personal/usePersonal';
import { StaffProfilePage } from './StaffProfilePage';

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
      phone: '069000000',
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
      if (path.startsWith('/api/personal/timesheet')) return jsonResponse({ rows: [] });
      if (path.startsWith('/api/personal/leaves')) return jsonResponse({ leaves: [], warnings: [] });
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/personal/STF-1']}>
        <Routes>
          <Route path="/personal/:id" element={<StaffProfilePage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('StaffProfilePage', () => {
  beforeEach(() => stubFetch());
  afterEach(() => vi.unstubAllGlobals());

  it('fișa arată zilele lucrate, concediul rămas și salariul ascuns', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Ana Popescu' })).toBeInTheDocument();
    expect(screen.getByText('Zile lucrate · boală')).toBeInTheDocument();
    expect(screen.getByText(/din 28/)).toBeInTheDocument();
    expect(screen.getByText('•••••')).toBeInTheDocument();
    expect(screen.getByText('Vezi cu PIN →')).toBeInTheDocument();
  });
});
