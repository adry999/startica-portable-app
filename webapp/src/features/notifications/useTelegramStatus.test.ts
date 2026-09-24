import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTelegramStatus } from './useTelegramStatus';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const unconfigured = {
  configured: false,
  connected: false,
  chatName: '',
  botUsername: '',
  lastRun: '',
  lastSuccess: '',
  lastError: '',
  stale: false,
};

const configured = {
  configured: true,
  connected: true,
  chatName: 'Grădinița',
  botUsername: 'startica_bot',
  lastRun: '2026-09-23T08:00:00.000Z',
  lastSuccess: '2026-09-23T08:00:00.000Z',
  lastError: '',
  stale: false,
};

describe('useTelegramStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('e loading, apoi ready cu statusul neconfigurat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/telegram-status') return jsonResponse(unconfigured);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useTelegramStatus());
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data?.configured).toBe(false);
  });

  it('connect trimite token-ul și reîmprospătează statusul', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/telegram-status') return jsonResponse(unconfigured);
        if (path === '/api/telegram-connect') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          expect(body.token).toBe('123:ABC');
          return jsonResponse({ ok: true });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useTelegramStatus());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => result.current.setTokenInput('123:ABC'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
      if (path === '/api/telegram-connect') return jsonResponse({ ok: true });
      if (path === '/api/telegram-status') return jsonResponse(configured);
      throw new Error(`neașteptat: ${path}`);
    });

    await act(() => result.current.connect());
    expect(result.current.tokenInput).toBe('');
    expect(result.current.data?.configured).toBe(true);
  });

  it('disconnect reîmprospătează statusul la neconfigurat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/telegram-status') return jsonResponse(configured);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useTelegramStatus());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
      if (path === '/api/telegram-disconnect') return jsonResponse({ ok: true });
      if (path === '/api/telegram-status') return jsonResponse(unconfigured);
      throw new Error(`neașteptat: ${path}`);
    });

    await act(() => result.current.disconnect());
    expect(result.current.data?.configured).toBe(false);
  });
});
