import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTimesheet } from './useTimesheet';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('useTimesheet', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('încarcă rândurile lunii și le indexează după angajat|zi', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/personal/timesheet?month=2026-09')
          return jsonResponse({ rows: [{ id: 'TS-1', staffId: 'STF-1', date: '2026-09-07', code: 'CO' }] });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useTimesheet('2026-09'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.rows.get('STF-1|2026-09-07')?.code).toBe('CO');
  });

  it('mark schimbă codul imediat și trimite un singur POST după 400 ms', async () => {
    const posted: { changes: unknown[] }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, options?: RequestInit) => {
        if (path === '/api/personal/timesheet?month=2026-09') return jsonResponse({ rows: [] });
        if (path === '/api/personal/timesheet' && options?.method === 'POST') {
          const body = JSON.parse(options.body as string) as {
            changes: { staffId: string; date: string; code: string | null }[];
          };
          posted.push(body);
          return jsonResponse({
            rows: body.changes
              .filter(change => change.code !== null)
              .map(change => ({ id: `${change.staffId}|${change.date}`, ...change })),
          });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useTimesheet('2026-09'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    vi.useFakeTimers();
    act(() => {
      result.current.mark([{ staffId: 'STF-1', date: '2026-09-07', code: 'CO' }]);
    });
    expect(result.current.rows.get('STF-1|2026-09-07')?.code).toBe('CO');
    expect(posted).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(posted).toHaveLength(1);
    expect(posted[0].changes).toEqual([{ staffId: 'STF-1', date: '2026-09-07', code: 'CO' }]);
  });

  it('un cod null șterge rândul local imediat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, options?: RequestInit) => {
        if (path === '/api/personal/timesheet?month=2026-09')
          return jsonResponse({ rows: [{ id: 'TS-1', staffId: 'STF-1', date: '2026-09-07', code: 'CO' }] });
        if (path === '/api/personal/timesheet' && options?.method === 'POST') return jsonResponse({ rows: [] });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useTimesheet('2026-09'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    vi.useFakeTimers();
    act(() => {
      result.current.mark([{ staffId: 'STF-1', date: '2026-09-07', code: null }]);
    });
    expect(result.current.rows.has('STF-1|2026-09-07')).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
  });
});
