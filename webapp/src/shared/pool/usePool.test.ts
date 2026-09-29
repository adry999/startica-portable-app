import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from '@shared/api/session';
import { usePoolWeek, usePoolMonth } from './usePool';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const EMPTY_WEEK = { days: [], stats: { scheduled: 0, present: 0, absent: 0, excused: 0 } };
const EMPTY_MONTH = { children: [], coaches: [], closing: null, unmarked: 0 };

function countCalls(prefix: string): number {
  return (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(call => String(call[0]).startsWith(prefix)).length;
}

/**
 * B-8: pe alt calculator sosesc marcaje de bazin prin sincronizare — `useSyncStatus` cheamă
 * `reloadRecords()`, care incrementează `session.state.revision`. Săptămâna/Luna Bazinului trebuie
 * să reîncarce la acel eveniment, nu doar la schimbarea datei/lunii sau la un marcaj local.
 */
// Revizie mereu crescătoare, la nivel de fișier (nu per test): `useAppSession` e un singleton la
// nivel de modul care supraviețuiește între cazuri — un contor resetat per test ar putea repeta o
// valoare deja văzută de store, iar `useEffect([..., revision])` n-ar mai vedea nicio schimbare.
let nextRevision = 1;

describe('usePoolWeek / usePoolMonth — reîncărcare la schimbarea reviziei sesiunii (B-8)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok-1', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({
            state: { children: [] },
            revision: ++nextRevision,
            updatedAt: '2026-09-23T10:00:00Z',
          });
        if (path === '/api/health') return jsonResponse({ ok: true });
        if (path.startsWith('/api/pool/week')) return jsonResponse(EMPTY_WEEK);
        if (path.startsWith('/api/pool/month')) return jsonResponse(EMPTY_MONTH);
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('usePoolWeek reîncarcă /api/pool/week după un records-changed (revizia sesiunii crește)', async () => {
    const week = renderHook(() => usePoolWeek('2026-09-08'));
    const session = renderHook(() => useAppSession());
    await waitFor(() => expect(week.result.current.loading).toBe(false));

    const before = countCalls('/api/pool/week');
    await act(() => session.result.current.load());
    await waitFor(() => expect(countCalls('/api/pool/week')).toBeGreaterThan(before));
  });

  it('usePoolMonth reîncarcă /api/pool/month după un records-changed (revizia sesiunii crește)', async () => {
    const month = renderHook(() => usePoolMonth('2026-09'));
    const session = renderHook(() => useAppSession());
    await waitFor(() => expect(month.result.current.loading).toBe(false));

    const before = countCalls('/api/pool/month');
    await act(() => session.result.current.load());
    await waitFor(() => expect(countCalls('/api/pool/month')).toBeGreaterThan(before));
  });
});
