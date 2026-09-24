import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNotificationPreferences } from './useNotificationPreferences';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const saved = {
  birthdaysEnabled: true,
  birthdaysDaysBefore: 2,
  visitsEnabled: true,
  visitsHorizonDays: 1,
  overdueEnabled: true,
  overdueCadence: 'monday',
  nothingToReportEnabled: true,
  digestTime: '08:00',
  windowsVisitsTodayEnabled: true,
  windowsVisitSoonEnabled: true,
  windowsVisitSoonMinutes: 30,
};

describe('useNotificationPreferences', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('e loading, apoi ready cu preferințele salvate, fără modificări', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/notification-settings') return jsonResponse(saved);
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useNotificationPreferences());
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.values.digestTime).toBe('08:00');
    expect(result.current.dirty).toBe(false);
  });

  it('schimbarea unui câmp marchează dirty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(saved)),
    );

    const { result } = renderHook(() => useNotificationPreferences());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => result.current.setField('digestTime', '09:00'));
    expect(result.current.dirty).toBe(true);
  });

  it('save trimite valorile curente și golește dirty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/notification-settings') {
          if (!init?.body) return jsonResponse(saved);
          const body = JSON.parse(String(init.body));
          expect(body.digestTime).toBe('09:00');
          return jsonResponse({ ...saved, digestTime: '09:00' });
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );

    const { result } = renderHook(() => useNotificationPreferences());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => result.current.setField('digestTime', '09:00'));
    await act(() => result.current.save());

    expect(result.current.dirty).toBe(false);
    expect(result.current.values.digestTime).toBe('09:00');
  });
});
