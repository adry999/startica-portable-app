import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSmsLastNotified } from './useSmsLastNotified';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
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
          return jsonResponse({ c1: { at: '2026-09-27T08:00:00.000Z', status: 'sent', month: '2026-09', templateName: 'Implicit' } });
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
});
