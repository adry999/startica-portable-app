import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSmsSend } from './useSmsSend';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const statusView = {
  configured: true,
  sender: 'Startica',
  tokenMasked: '••••1234',
  monthlyLimit: null,
  sentThisMonth: 1,
  failedThisMonth: 0,
  segmentsThisMonth: 1,
  balance: '100.00',
  balanceCheckedAt: '2026-09-27T08:00:00.000Z',
  unitCost: 0.3,
  lastError: '',
};

const sentResult = {
  ok: true,
  results: [{ childId: 'c1', outcome: 'sent', logId: 1, segments: 1, cost: '0.30', error: '' }],
  stopped: null,
  status: statusView,
};

const allFailedResult = {
  ok: true,
  results: [{ childId: 'c1', outcome: 'failed', logId: 1, segments: 1, cost: null, error: 'eșec' }],
  stopped: null,
  status: statusView,
};

describe('useSmsSend', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('send trimite request-ul la /api/sms-send și expune ultimul rezultat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/sms-send') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          expect(body.source).toBe('notify');
          return jsonResponse(sentResult);
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSmsSend());
    await act(() =>
      result.current.send({ source: 'notify', month: '2026-09', templateId: null, messages: [] }),
    );

    expect(result.current.lastResult?.results).toHaveLength(1);
    expect(result.current.sending).toBe(false);
  });

  it('programează exact o reîmprospătare a stărilor la 30s după un rezultat cu trimiteri', async () => {
    const fetchMock = vi.fn(async (path: string) => {
      if (path === '/api/sms-send') return jsonResponse(sentResult);
      if (path === '/api/sms-refresh-statuses') return jsonResponse({ ok: true });
      throw new Error(`neașteptat: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSmsSend());
    await act(() => result.current.send({ source: 'notify', month: '2026-09', templateId: null, messages: [] }));

    expect(fetchMock).not.toHaveBeenCalledWith('/api/sms-refresh-statuses', expect.anything());

    await act(() => vi.advanceTimersByTimeAsync(30000));

    expect(fetchMock).toHaveBeenCalledWith('/api/sms-refresh-statuses', expect.anything());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('nu programează reîmprospătare când nimic n-a fost trimis', async () => {
    const fetchMock = vi.fn(async (path: string) => {
      if (path === '/api/sms-send') return jsonResponse(allFailedResult);
      throw new Error(`neașteptat: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSmsSend());
    await act(() => result.current.send({ source: 'notify', month: '2026-09', templateId: null, messages: [] }));

    await act(() => vi.advanceTimersByTimeAsync(30000));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
