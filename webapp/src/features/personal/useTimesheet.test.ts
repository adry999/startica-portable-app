import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTimesheet } from './useTimesheet';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

/** O promisiune controlată din exterior — pentru a decide manual ordinea în care „sosesc” două cereri. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
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

  // M11: schimbarea rapidă a lunii poate porni un al doilea GET înainte ca primul să răspundă;
  // dacă luna părăsită răspunde ultima, nu trebuie să suprascrie luna curentă afișată.
  it('un răspuns întârziat al unei luni părăsite nu suprascrie luna curentă (race la schimbarea query-ului)', async () => {
    const sep = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const oct = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/personal/timesheet?month=2026-09') return sep.promise;
        if (path === '/api/personal/timesheet?month=2026-10') return oct.promise;
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result, rerender } = renderHook(({ month }: { month: string }) => useTimesheet(month), {
      initialProps: { month: '2026-09' },
    });
    rerender({ month: '2026-10' }); // pas rapid, înainte ca cererea lunii 09 să răspundă

    await act(async () => {
      oct.resolve(jsonResponse({ rows: [{ id: 'TS-2', staffId: 'STF-1', date: '2026-10-07', code: 'CM' }] }));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      sep.resolve(jsonResponse({ rows: [{ id: 'TS-1', staffId: 'STF-1', date: '2026-09-07', code: 'CO' }] }));
      await Promise.resolve();
    });

    expect(result.current.rows.has('STF-1|2026-10-07')).toBe(true);
    expect(result.current.rows.has('STF-1|2026-09-07')).toBe(false);
  });
});
