import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppSession } from './session';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe('useAppSession', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/session') return jsonResponse({ token: 'tok-1', version: '1.6.3' });
        if (path === '/api/state')
          return jsonResponse({ state: { children: [] }, revision: 1, updatedAt: '2026-09-23T10:00:00Z' });
        if (path === '/api/health') return jsonResponse({ ok: true });
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('load() populează token, revizie și starea din cele trei apeluri', async () => {
    const { result } = renderHook(() => useAppSession());
    await act(() => result.current.load());

    expect(result.current.state.token).toBe('tok-1');
    expect(result.current.state.revision).toBe(1);
    expect(result.current.state.ready).toBe(true);
    expect(result.current.state.health).toEqual({ ok: true });
  });

  it('mutate() trimite revizia curentă și un requestId, apoi actualizează starea din răspuns', async () => {
    const { result } = renderHook(() => useAppSession());
    await act(() => result.current.load());

    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      expect(body.revision).toBe(1);
      expect(typeof body.requestId).toBe('string');
      return jsonResponse({ state: { children: [{ id: 'c1' }] }, revision: 2, updatedAt: '2026-09-23T10:05:00Z' });
    });

    await act(() => result.current.mutate('/api/children/create', { name: 'Andrei' }));

    expect(result.current.state.revision).toBe(2);
    expect(result.current.state.state).toEqual({ children: [{ id: 'c1' }] });
  });

  it('reîmprospătează tokenul după un 403 la mutație', async () => {
    const { result } = renderHook(() => useAppSession());
    await act(() => result.current.load());

    (fetch as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(async () => ({ ok: false, status: 403, json: async () => ({ error: 'Token expirat' }) }))
      .mockImplementationOnce(async () => jsonResponse({ token: 'tok-2', version: '1.6.3' }));

    await expect(result.current.mutate('/api/children/create', { name: 'Andrei' })).rejects.toThrow();
    await waitFor(() => expect(result.current.state.token).toBe('tok-2'));
  });
});
