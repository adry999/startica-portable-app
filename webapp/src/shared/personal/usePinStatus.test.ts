import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePinStatus } from './usePinStatus';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('usePinStatus', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('setează PIN-ul nou și reîncarcă starea', async () => {
    let configured = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, options?: RequestInit) => {
        if (path === '/api/personal/pin' && !options?.method) return jsonResponse({ configured, unlocked: false });
        if (path === '/api/personal/pin' && options?.method === 'POST') {
          configured = true;
          return jsonResponse({ ok: true });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => usePinStatus());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.configured).toBe(false);

    await act(async () => {
      const outcome = await result.current.set('1234');
      expect(outcome.ok).toBe(true);
    });

    await waitFor(() => expect(result.current.configured).toBe(true));
  });

  it('5 greșeli consecutive raportează blocarea temporară (429)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, options?: RequestInit) => {
        if (path === '/api/personal/pin' && !options?.method)
          return jsonResponse({ configured: true, unlocked: false });
        if (path === '/api/personal/pin/unlock')
          return jsonResponse({ error: 'Prea multe încercări. Așteaptă 60 s.' }, false, 429);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => usePinStatus());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const outcome = await result.current.unlock('0000');
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toMatch(/Prea multe încercări/);
  });
});
