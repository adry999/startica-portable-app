import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { today } from '@domain/calendar-month.mjs';
import { useExchangeRates } from './useExchangeRates';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const todayDate = today();
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

const initialRates = { [todayDate]: 19.62, [yesterday]: 19.58 };
const initialSources = { [todayDate]: 'bnm', [yesterday]: 'bnm' };
const initialPresets = [{ id: 'PLAN-1', name: 'Program standard', priceEur: 150 }];

describe('useExchangeRates', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        const isPost = init?.method === 'POST';
        if (path === '/api/exchange-rates' && !isPost)
          return jsonResponse({ rates: initialRates, sources: initialSources });
        if (path === '/api/plan-presets' && !isPost) return jsonResponse(initialPresets);
        if (path === '/api/exchange-rates' && isPost) {
          const body = JSON.parse(String(init?.body ?? '{}'));
          const rates = { ...initialRates, [body.date]: body.rate };
          const sources = { ...initialSources, [body.date]: 'manual' };
          return jsonResponse({ rates, sources });
        }
        if (path === '/api/exchange-rates/refresh') {
          const rates = { ...initialRates, [todayDate]: 19.7 };
          const sources = { ...initialSources, [todayDate]: 'bnm' };
          return jsonResponse({ ok: true, rates, sources });
        }
        if (path === '/api/plan-presets' && isPost) {
          const body = JSON.parse(String(init?.body ?? '[]'));
          return jsonResponse(body);
        }
        throw new Error(`neașteptat: ${path}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('nu e ready înainte de încărcare, apoi expune cursul de azi și ultimele zile', async () => {
    const { result } = renderHook(() => useExchangeRates());
    expect(result.current.ready).toBe(false);

    await vi.waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.todayRate).toBe(19.62);
    expect(result.current.todayTone).toBe('mint');
    expect(result.current.lastFiveDays[0]?.date).toBe(todayDate);
    expect(result.current.presets).toEqual(initialPresets);
  });

  it('correctToday trimite data de azi și marchează sursa drept manuală', async () => {
    const { result } = renderHook(() => useExchangeRates());
    await vi.waitFor(() => expect(result.current.ready).toBe(true));

    await act(() => result.current.correctToday(20.1));

    expect(result.current.todayRate).toBe(20.1);
    expect(result.current.todayTone).toBe('yellow');
  });

  it('refreshFromBnm reia cursul BNM și redevine "mint"', async () => {
    const { result } = renderHook(() => useExchangeRates());
    await vi.waitFor(() => expect(result.current.ready).toBe(true));
    await act(() => result.current.correctToday(20.1));
    expect(result.current.todayTone).toBe('yellow');

    let outcome: { ok: boolean; error?: string } = { ok: false };
    await act(async () => {
      outcome = await result.current.refreshFromBnm();
    });

    expect(outcome.ok).toBe(true);
    expect(result.current.todayRate).toBe(19.7);
    expect(result.current.todayTone).toBe('mint');
  });

  it('savePresets trimite lista completă și actualizează starea locală', async () => {
    const { result } = renderHook(() => useExchangeRates());
    await vi.waitFor(() => expect(result.current.ready).toBe(true));

    const next = [...initialPresets, { id: 'PLAN-2', name: 'Program redus', priceEur: 100 }];
    await act(() => result.current.savePresets(next));

    expect(result.current.presets).toEqual(next);
  });
});
