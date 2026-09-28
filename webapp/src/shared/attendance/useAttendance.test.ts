import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAttendance } from './useAttendance';

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

describe('useAttendance', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('încarcă rândurile zilei și le indexează după copil|zi', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/attendance?date=2026-09-27')
          return jsonResponse({
            entries: [
              { childId: 'c1', date: '2026-09-27', status: 'present', reason: '', updatedAt: '2026-09-27T08:00:00Z' },
            ],
          });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useAttendance({ date: '2026-09-27' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.entries.get('c1|2026-09-27')?.status).toBe('present');
  });

  it('mark schimbă starea imediat și trimite un singur POST după 400 ms, cu ultima schimbare per copil·zi', async () => {
    const posted: { changes: unknown[] }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, options?: RequestInit) => {
        if (path === '/api/attendance?date=2026-09-27') return jsonResponse({ entries: [] });
        if (path === '/api/attendance' && options?.method === 'POST') {
          const body = JSON.parse(options.body as string) as {
            changes: { childId: string; date: string; status: string | null }[];
          };
          posted.push(body);
          return jsonResponse({
            ok: true,
            saved: body.changes
              .filter(change => change.status !== null)
              .map(change => ({ ...change, reason: '', updatedAt: '2026-09-27T09:00:00Z' })),
            removed: body.changes
              .filter(change => change.status === null)
              .map(({ childId, date }) => ({ childId, date })),
          });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useAttendance({ date: '2026-09-27' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    vi.useFakeTimers();
    act(() => {
      result.current.mark([{ childId: 'c1', date: '2026-09-27', status: 'present' }]);
    });
    expect(result.current.entries.get('c1|2026-09-27')?.status).toBe('present');
    expect(posted).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(posted).toHaveLength(1);
    expect(posted[0].changes).toEqual([{ childId: 'c1', date: '2026-09-27', status: 'present' }]);
  });

  it('două mark-uri în 400 ms se cumulează într-o singură cerere', async () => {
    const posted: { changes: unknown[] }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, options?: RequestInit) => {
        if (path === '/api/attendance?date=2026-09-27') return jsonResponse({ entries: [] });
        if (path === '/api/attendance' && options?.method === 'POST') {
          const body = JSON.parse(options.body as string) as {
            changes: { childId: string; date: string; status: string | null }[];
          };
          posted.push(body);
          return jsonResponse({
            ok: true,
            saved: body.changes.map(change => ({ ...change, reason: '', updatedAt: '2026-09-27T09:00:00Z' })),
            removed: [],
          });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useAttendance({ date: '2026-09-27' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    vi.useFakeTimers();
    act(() => {
      result.current.mark([{ childId: 'c1', date: '2026-09-27', status: 'present' }]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    act(() => {
      result.current.mark([{ childId: 'c2', date: '2026-09-27', status: 'absent' }]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(posted).toHaveLength(1);
    expect(posted[0].changes).toEqual([
      { childId: 'c1', date: '2026-09-27', status: 'present' },
      { childId: 'c2', date: '2026-09-27', status: 'absent' },
    ]);
  });

  it('un POST eșuat pune saveError și reîncarcă de la server', async () => {
    let getCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, options?: RequestInit) => {
        if (path === '/api/attendance?date=2026-09-27') {
          getCalls++;
          return jsonResponse({ entries: [] });
        }
        if (path === '/api/attendance' && options?.method === 'POST')
          return jsonResponse({ error: 'Cerere respinsă.' }, false, 400);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useAttendance({ date: '2026-09-27' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(getCalls).toBe(1);

    vi.useFakeTimers();
    act(() => {
      result.current.mark([{ childId: 'c1', date: '2026-09-27', status: 'present' }]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(result.current.saveError).toBe('Cerere respinsă.');
    expect(getCalls).toBe(2);
  });

  // M11: pași rapizi cu DayStepper pot porni o a doua cerere (GET) înainte ca prima să răspundă;
  // dacă răspunsul zilei vechi sosește ultimul, nu trebuie să suprascrie datele zilei noi afișate.
  it('un răspuns întârziat al unei zile părăsite nu suprascrie ziua curentă (race la schimbarea query-ului)', async () => {
    const day27 = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const day28 = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/attendance?date=2026-09-27') return day27.promise;
        if (path === '/api/attendance?date=2026-09-28') return day28.promise;
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result, rerender } = renderHook(({ date }: { date: string }) => useAttendance({ date }), {
      initialProps: { date: '2026-09-27' },
    });
    rerender({ date: '2026-09-28' }); // pas rapid, înainte ca cererea zilei 27 să răspundă

    // Ziua nouă (28) răspunde prima.
    await act(async () => {
      day28.resolve(
        jsonResponse({
          entries: [{ childId: 'c2', date: '2026-09-28', status: 'present', reason: '', updatedAt: '' }],
        }),
      );
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    // Răspunsul vechi (27) sosește ultimul — nu trebuie să mai fie aplicat.
    await act(async () => {
      day27.resolve(
        jsonResponse({
          entries: [{ childId: 'c1', date: '2026-09-27', status: 'present', reason: '', updatedAt: '' }],
        }),
      );
      await Promise.resolve();
    });

    expect(result.current.entries.has('c2|2026-09-28')).toBe(true);
    expect(result.current.entries.has('c1|2026-09-27')).toBe(false);
  });

  it('query null nu face nicio cerere', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAttendance(null));
    expect(result.current.status).toBe('ready');
    expect(result.current.entries.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
