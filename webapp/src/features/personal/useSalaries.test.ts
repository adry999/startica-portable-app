import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSalaries } from './useSalaries';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('useSalaries', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('un 403 pune ecranul pe „locked”', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'Salariile sunt protejate. Introdu PIN-ul.' }, false, 403)),
    );

    const { result } = renderHook(() => useSalaries('2026-09'));
    await waitFor(() => expect(result.current.status).toBe('locked'));
  });

  it('cu PIN deblocat, lista lunii se încarcă cu totalurile', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/personal/salaries?month=2026-09')
          return jsonResponse({
            rows: [
              {
                staff: { id: 'STF-1', name: 'Ana Popescu' },
                mode: 'fix',
                base: '10000 lei / lună',
                gross: 10000,
                advances: 0,
                net: 10000,
                paid: null,
              },
            ],
            totals: { gross: 10000, advances: 0, net: 10000, paid: 0 },
          });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSalaries('2026-09'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.totals?.net).toBe(10000);
  });
});
