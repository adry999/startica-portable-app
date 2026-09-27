import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedLoading } from './useDelayedLoading';

describe('useDelayedLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rămâne ascuns cât timp nu a trecut pragul', () => {
    const { result } = renderHook(() => useDelayedLoading(true, 300));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe(false);
  });

  it('apare imediat după prag, cât timp activ rămâne adevărat', () => {
    const { result } = renderHook(() => useDelayedLoading(true, 300));

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(true);
  });

  it('nu apare deloc dacă activ devine fals înainte de prag', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedLoading(active, 300), {
      initialProps: { active: true },
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(false);
  });

  it('revine la ascuns imediat ce activ devine fals, chiar după ce a apărut', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedLoading(active, 300), {
      initialProps: { active: true },
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(true);

    rerender({ active: false });
    expect(result.current).toBe(false);
  });
});
