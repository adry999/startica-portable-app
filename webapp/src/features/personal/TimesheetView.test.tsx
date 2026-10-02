import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { ToastProvider } from '@shared/ui';
import { reloadPersonal } from '@shared/personal/usePersonal';
import { weekStartOf } from '@shared/personal/timesheet-rules';
import { today } from '#shared/domain/calendar-month.mjs';
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
let postedFill: { mode: string; weekStart: string; staffIds?: string[] }[] = [];

function stubFetch() {
  posted = [];
  postedFill = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, options?: RequestInit) => {
      if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3', branch: null, branches: [] });
      if (path === '/api/state')
        return jsonResponse({
          state: { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] },
          revision: 1,
          updatedAt: '2026-09-23T10:00:00Z',
        });
      if (path === '/api/health') return jsonResponse({});
      if (path === '/api/kindergarten') return jsonResponse({ name: 'Grădinița Test', idno: '' });
      if (path === '/api/personal/state') return jsonResponse(fixturePersonalState);
      if (path === '/api/personal/timesheet-fill' && options?.method === 'POST') {
        const body = JSON.parse(options.body as string) as { mode: string; weekStart: string; staffIds?: string[] };
        postedFill.push(body);
        return jsonResponse({ filled: 3, rows: [] });
      }
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
        <TimesheetView month="2026-09" printDialogOpen={false} onPrintDialogClose={() => {}} />
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

  it('zilele viitoare ciclează doar gol → CO → CM → gol, fără A', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    render(
      <ToastProvider>
        <TimesheetView month="2026-12" printDialogOpen={false} onPrintDialogClose={() => {}} />
      </ToastProvider>,
    );

    await screen.findByText('Ana Popescu');
    // 2026-12-07 e luni, zi lucrătoare, în viitor față de „azi” (2026-09-29 în acest mediu de test).
    const cell = screen.getByRole('button', { name: 'Ana Popescu: 2026-12-07' });

    vi.useFakeTimers();
    act(() => fireEvent.click(cell));
    expect(cell).toHaveTextContent('CO');

    act(() => fireEvent.click(cell));
    expect(cell).toHaveTextContent('CM');

    act(() => fireEvent.click(cell));
    expect(cell).toHaveTextContent('');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(posted).toHaveLength(1);
    expect(posted[0].changes).toEqual([{ staffId: 'STF-1', date: '2026-12-07', code: null }]);
  });

  it('nu tipărește până nu se încarcă datele grădiniței (M4)', async () => {
    await loadedSession();
    await act(() => reloadPersonal());

    let resolveKindergarten = () => {};
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
        if (path === '/api/kindergarten')
          return new Promise(resolve => {
            resolveKindergarten = () => resolve(jsonResponse({ name: 'Grădinița Test', idno: '' }));
          });
        if (path === '/api/personal/state') return jsonResponse(fixturePersonalState);
        if (path.startsWith('/api/personal/timesheet') && (!options || options.method !== 'POST'))
          return jsonResponse({ rows: [] });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    render(
      <ToastProvider>
        <TimesheetView month="2026-09" printDialogOpen onPrintDialogClose={() => {}} />
      </ToastProvider>,
    );

    await screen.findByText('Ana Popescu');
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup();

    const dialog = screen.getByRole('dialog', { name: 'Tipărește pontajul' });
    await user.click(within(dialog).getByRole('button', { name: 'Tipărește' }));

    // /api/kindergarten n-a răspuns încă — tipărirea trebuie să aștepte.
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(printSpy).not.toHaveBeenCalled();

    resolveKindergarten();
    await vi.waitFor(() => expect(printSpy).toHaveBeenCalled());
  });

  describe('§9.2/41b: completare rapidă pe săptămână', () => {
    const currentMonth = today().slice(0, 7);
    const expectedWeekStart = weekStartOf(today());

    it('WeekFillBar apare doar pe luna curentă, nu pe o lună diferită', async () => {
      await loadedSession();
      await act(() => reloadPersonal());

      const { rerender } = render(
        <ToastProvider>
          <TimesheetView month={currentMonth} printDialogOpen={false} onPrintDialogClose={() => {}} />
        </ToastProvider>,
      );
      await screen.findByText('Ana Popescu');
      expect(screen.getByRole('button', { name: 'Toți prezenți L–V' })).toBeInTheDocument();

      rerender(
        <ToastProvider>
          <TimesheetView month="2026-12" printDialogOpen={false} onPrintDialogClose={() => {}} />
        </ToastProvider>,
      );
      await screen.findByText('Ana Popescu');
      expect(screen.queryByRole('button', { name: 'Toți prezenți L–V' })).not.toBeInTheDocument();
    });

    it('„Toți prezenți L–V” cheamă completarea pentru toată filiala, pe săptămâna curentă', async () => {
      await loadedSession();
      await act(() => reloadPersonal());

      render(
        <ToastProvider>
          <TimesheetView month={currentMonth} printDialogOpen={false} onPrintDialogClose={() => {}} />
        </ToastProvider>,
      );
      await screen.findByText('Ana Popescu');

      await userEvent.click(screen.getByRole('button', { name: 'Toți prezenți L–V' }));

      expect(postedFill).toEqual([{ mode: 'present', weekStart: expectedWeekStart, staffIds: undefined }]);
      expect(await screen.findByText('3 zile completate.')).toBeInTheDocument();
    });

    it('„Copiază săpt. trecută” cheamă completarea cu modul corespunzător', async () => {
      await loadedSession();
      await act(() => reloadPersonal());

      render(
        <ToastProvider>
          <TimesheetView month={currentMonth} printDialogOpen={false} onPrintDialogClose={() => {}} />
        </ToastProvider>,
      );
      await screen.findByText('Ana Popescu');

      await userEvent.click(screen.getByRole('button', { name: 'Copiază săpt. trecută' }));

      expect(postedFill).toEqual([{ mode: 'copy-previous-week', weekStart: expectedWeekStart, staffIds: undefined }]);
    });

    it('„Prezent toată săptămâna” pe rând trimite doar staffId-ul acelui angajat', async () => {
      await loadedSession();
      await act(() => reloadPersonal());

      render(
        <ToastProvider>
          <TimesheetView month={currentMonth} printDialogOpen={false} onPrintDialogClose={() => {}} />
        </ToastProvider>,
      );
      await screen.findByText('Ana Popescu');

      await userEvent.click(screen.getByLabelText('Acțiuni pontaj Ana Popescu'));
      await userEvent.click(screen.getByRole('button', { name: 'Prezent toată săptămâna' }));

      expect(postedFill).toEqual([{ mode: 'present', weekStart: expectedWeekStart, staffIds: ['STF-1'] }]);
    });
  });
});
