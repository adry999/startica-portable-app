import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { useAttendanceMonth } from './useAttendanceMonth';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const fixtureState = {
  children: [
    { id: 'c1', name: 'Ana Popescu', groupId: 'g2', status: 'Activ', archived: false },
    { id: 'c2', name: 'Bogdan Rusu', groupId: 'g1', status: 'Activ', archived: false },
  ],
  payments: [],
  expenses: [],
  groups: [
    { id: 'g1', name: 'Ursuleți', capacity: 10 },
    { id: 'g2', name: 'Fluturași', capacity: 10 },
  ],
  categories: [],
  visits: [],
};

async function loadedSession() {
  const session = renderHook(() => useAppSession());
  await act(() => session.result.current.load());
  return session;
}

describe('useAttendanceMonth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: fixtureState, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({});
        if (path.startsWith('/api/attendance')) return jsonResponse({ entries: [] });
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  it('grupa implicită e prima după nume, iar alegerea se persistă', async () => {
    await loadedSession();
    const { result, rerender } = renderHook(() => useAttendanceMonth('2020-01'));
    expect(result.current.groupId).toBe('g2'); // Fluturași < Ursuleți

    act(() => result.current.setGroupId('g1'));
    rerender();
    expect(result.current.groupId).toBe('g1');
    expect(localStorage.getItem('attendance.group')).toBe('g1');
  });

  it('weekend-urile și sărbătorile nu intră în „Zile”, zilele viitoare nu sunt clicabile', async () => {
    await loadedSession();

    const past = renderHook(() => useAttendanceMonth('2020-01'));
    // Ianuarie 2020: 31 zile, cu 1 ianuarie sărbătoare și weekend-uri — sub 31 zile lucrătoare.
    expect(past.result.current.rows[0].workingDays).toBeLessThan(31);
    expect(past.result.current.offDays[0]).toBe(true); // 1 ianuarie

    const future = renderHook(() => useAttendanceMonth('2099-01'));
    const futureRow = future.result.current.rows.find(row => row.id === 'c1');
    const workingCell = futureRow?.cells.find(cell => !future.result.current.offDays[futureRow.cells.indexOf(cell)]);
    expect(workingCell?.kind).toBe('future');
  });
});
