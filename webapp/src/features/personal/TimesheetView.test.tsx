import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { reloadPersonal } from '@shared/personal/usePersonal';
import { TimesheetView } from './TimesheetView';

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

let posted: { changes: unknown[] }[] = [];

function stubFetch() {
  posted = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, options?: RequestInit) => {
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
      if (path.startsWith('/api/personal/timesheet') && (!options || options.method !== 'POST'))
        return jsonResponse({ rows: [] });
      if (path === '/api/personal/timesheet' && options?.method === 'POST') {
        const body = JSON.parse(options.body as string) as { changes: unknown[] };
        posted.push(body);
        return jsonResponse({ rows: [] });
      }
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('TimesheetView', () => {
  beforeEach(() => stubFetch());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clic pe celulă ciclează gol → CO → CM → A → gol și trimite un singur POST', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <TimesheetView month="2026-09" />
      </ToastProvider>,
    );

    await screen.findByText('Ana Popescu');
    // 2026-09-07 e luni, zi lucrătoare.
    const cell = screen.getByRole('button', { name: 'Ana Popescu: 2026-09-07' });

    vi.useFakeTimers();
    act(() => {
      fireEvent.click(cell);
    });
    expect(cell).toHaveTextContent('CO');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(posted).toHaveLength(1);
    expect(posted[0].changes).toEqual([{ staffId: 'STF-1', date: '2026-09-07', code: 'CO' }]);
  });
});
