import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSmsStatus } from './useSmsStatus';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

/** O promisiune controlată din exterior — pentru a decide manual ordinea în care „sosesc” două cereri. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

const unconfigured = {
  configured: false,
  sender: '',
  tokenMasked: '',
  monthlyLimit: null,
  sentThisMonth: 0,
  failedThisMonth: 0,
  segmentsThisMonth: 0,
  balance: null,
  balanceCheckedAt: '',
  unitCost: 0.3,
  lastError: '',
};

const configured = {
  configured: true,
  sender: 'Startica',
  tokenMasked: '••••1234',
  monthlyLimit: 500,
  sentThisMonth: 12,
  failedThisMonth: 1,
  segmentsThisMonth: 14,
  balance: '120.00',
  balanceCheckedAt: '2026-09-27T08:00:00.000Z',
  unitCost: 0.3,
  lastError: '',
};

describe('useSmsStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('e loading, apoi ready cu statusul neconfigurat și unitCost', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sms-status') return jsonResponse(unconfigured);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSmsStatus());
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data?.configured).toBe(false);
    expect(result.current.data?.unitCost).toBe(0.3);
  });

  it('connect trimite token, expeditor și limita lunară, apoi reîmprospătează statusul', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/sms-status') return jsonResponse(unconfigured);
        if (path === '/api/sms-connect') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          expect(body).toEqual({ token: 'abc123', sender: 'Startica', monthlyLimit: 500 });
          return jsonResponse({ ok: true });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSmsStatus());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
      if (path === '/api/sms-connect') return jsonResponse({ ok: true });
      if (path === '/api/sms-status') return jsonResponse(configured);
      throw new Error(`neașteptat: ${path}`);
    });

    await act(() => result.current.connect({ token: 'abc123', sender: 'Startica', monthlyLimit: 500 }));
    expect(result.current.data?.configured).toBe(true);
  });

  it('disconnect reîmprospătează statusul la neconfigurat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sms-status') return jsonResponse(configured);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSmsStatus());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
      if (path === '/api/sms-disconnect') return jsonResponse({ ok: true });
      if (path === '/api/sms-status') return jsonResponse(unconfigured);
      throw new Error(`neașteptat: ${path}`);
    });

    await act(() => result.current.disconnect());
    expect(result.current.data?.configured).toBe(false);
  });

  it('sendTest trimite telefonul și reîmprospătează statusul', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sms-status') return jsonResponse(configured);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSmsStatus());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/sms-test') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.phone).toBe('+37369000000');
        return jsonResponse({ ok: true });
      }
      if (path === '/api/sms-status') return jsonResponse(configured);
      throw new Error(`neașteptat: ${path}`);
    });

    await act(() => result.current.sendTest('+37369000000'));
    expect(result.current.testing).toBe(false);
  });

  // M11: `cancelled` din efectul de montare protejează doar `catch`-ul — un răspuns de succes sosit
  // târziu (montare) putea suprascrie o reîmprospătare mai nouă (declanșată de sendTest/connect/disconnect).
  it('un răspuns de la montare sosit după o reîmprospătare mai nouă nu o suprascrie', async () => {
    const mountDeferred = deferred<{ ok: boolean; status: number; json: () => Promise<unknown> }>();
    let statusCallCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sms-status') {
          statusCallCount += 1;
          if (statusCallCount === 1) return mountDeferred.promise; // cererea de la montare, lentă
          return jsonResponse(configured); // reîmprospătarea declanșată de sendTest, rapidă
        }
        if (path === '/api/sms-test') return jsonResponse({ ok: true });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSmsStatus());
    expect(result.current.status).toBe('loading');

    await act(() => result.current.sendTest('+37369000000'));
    expect(result.current.data?.configured).toBe(true);

    await act(async () => {
      mountDeferred.resolve(jsonResponse(unconfigured));
      await Promise.resolve();
    });

    expect(result.current.data?.configured).toBe(true); // răspunsul vechi de la montare nu trebuie aplicat
  });
});
