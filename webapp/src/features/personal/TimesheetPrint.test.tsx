import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppSession } from '@shared/api/session';
import { TimesheetPrint } from './TimesheetPrint';
import type { Staff, TimesheetRow } from '@shared/personal/personal.types';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function makeStaff(count: number): Staff[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `STF-${index}`,
    name: `Angajat ${String(index).padStart(2, '0')}`,
    roleId: 'ROL-1',
    branchIds: ['bu'],
    phone: '',
    since: '2020-01-01',
    archivedAt: null,
    notes: [],
  }));
}

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/session')
        return jsonResponse({
          token: 'tok',
          version: '1.6.3',
          branch: { id: 'bu', name: 'Buiucani', color: '' },
          branches: [],
        });
      if (path === '/api/state')
        return jsonResponse({
          state: { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [] },
          revision: 1,
          updatedAt: '2026-09-23T10:00:00Z',
        });
      if (path === '/api/health') return jsonResponse({});
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
}

describe('TimesheetPrint', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('foaia are @page A4 landscape, o coloană pe zi și antetul tabelului se repetă pe pagina 2', async () => {
    stubFetch();
    await loadedSession();

    const staff = makeStaff(20);
    const rows = new Map<string, TimesheetRow>();

    const { container } = render(
      <TimesheetPrint
        month="2026-09"
        staff={staff}
        rows={rows}
        roleName={() => 'Educator'}
        kindergarten={{ displayName: 'Grădinița Startica' } as never}
        display="hours"
      />,
    );

    expect((await screen.findAllByText(/Grădinița Startica/)).length).toBeGreaterThan(0);
    expect(container.innerHTML).toContain('@page { size: A4 landscape; margin: 10mm; }');

    const tables = container.querySelectorAll('table');
    expect(tables.length).toBe(2);
    for (const table of tables) {
      const bodyRows = table.querySelectorAll('tbody tr');
      expect(bodyRows.length).toBeLessThanOrEqual(14);
      expect(table.querySelectorAll('thead th').length).toBeGreaterThan(0);
    }
    expect(tables[0].querySelectorAll('tbody tr').length).toBe(14);
    expect(tables[1].querySelectorAll('tbody tr').length).toBe(6);
  });
});
