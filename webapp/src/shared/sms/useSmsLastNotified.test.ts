import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSmsLastNotified } from './useSmsLastNotified';

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

describe('useSmsLastNotified', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('încarcă notificările pe copil', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sms-last-notified')
          return jsonResponse({
            c1: { at: '2026-09-27T08:00:00.000Z', status: 'sent', month: '2026-09', templateName: 'Implicit' },
          });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSmsLastNotified());
    await waitFor(() => expect(Object.keys(result.current.byChild)).toHaveLength(1));

    expect(result.current.byChild.c1.status).toBe('sent');
  });

  it('notifiedToday e true doar pentru data locală de azi', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sms-last-notified')
          return jsonResponse({
            c1: { at: '2026-09-27T08:00:00.000Z', status: 'sent', month: '2026-09', templateName: 'Implicit' },
            c2: { at: '2026-09-26T08:00:00.000Z', status: 'sent', month: '2026-09', templateName: 'Implicit' },
          });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSmsLastNotified());
    await waitFor(() => expect(Object.keys(result.current.byChild)).toHaveLength(2));

    expect(result.current.notifiedToday('c1', '2026-09-27')).toBe(true);
    expect(result.current.notifiedToday('c2', '2026-09-27')).toBe(false);
    expect(result.current.notifiedToday('c3', '2026-09-27')).toBe(false);
  });

  it('un SMS trimis la 00:30 ora locală contează ca „azi”, chiar dacă UTC arată ziua precedentă', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        // 00:30 la București (UTC+3, vara) în 28 septembrie e 21:30 UTC în 27 septembrie.
        if (path === '/api/sms-last-notified')
          return jsonResponse({
            c1: { at: '2026-09-27T21:30:00.000Z', status: 'sent', month: '2026-09', templateName: 'Implicit' },
          });
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useSmsLastNotified());
    await waitFor(() => expect(Object.keys(result.current.byChild)).toHaveLength(1));

    expect(result.current.notifiedToday('c1', '2026-09-28')).toBe(true);
  });

  // M11: `cancelled` din efectul de montare protejează doar `catch`-ul — un răspuns de succes sosit
  // târziu (montare) putea suprascrie o reîmprospătare mai nouă (declanșată de refresh()).
  it('un răspuns de la montare sosit după refresh() nu suprascrie datele reîmprospătate', async () => {
    const mountDeferred = deferred<{ ok: boolean; status: number; json: () => Promise<unknown> }>();
    let callCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path !== '/api/sms-last-notified') throw new Error(`neașteptat: ${path}`);
        callCount += 1;
        if (callCount === 1) return mountDeferred.promise; // cererea de la montare, lentă
        return jsonResponse({
          c1: { at: '2026-09-27T08:00:00.000Z', status: 'sent', month: '2026-09', templateName: 'Implicit' },
        }); // reîmprospătarea din refresh(), rapidă
      }),
    );

    const { result } = renderHook(() => useSmsLastNotified());
    await act(() => result.current.refresh());
    expect(Object.keys(result.current.byChild)).toHaveLength(1);

    await act(async () => {
      mountDeferred.resolve(jsonResponse({})); // lista veche, goală
      await Promise.resolve();
    });

    expect(Object.keys(result.current.byChild)).toHaveLength(1); // reîmprospătarea nu trebuie ștearsă
  });
});
