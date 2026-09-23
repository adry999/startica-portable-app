import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePersistedState } from './usePersistedState';

describe('usePersistedState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('pornește cu valoarea implicită când nu există nimic salvat', () => {
    const { result } = renderHook(() => usePersistedState('viewMode.payments', 'table'));
    expect(result.current[0]).toBe('table');
  });

  it('citește valoarea deja salvată în localStorage', () => {
    localStorage.setItem('viewMode.payments', 'monthly');
    const { result } = renderHook(() => usePersistedState('viewMode.payments', 'table'));
    expect(result.current[0]).toBe('monthly');
  });

  it('salvează în localStorage la schimbare', () => {
    const { result } = renderHook(() => usePersistedState<'table' | 'monthly'>('viewMode.payments', 'table'));
    act(() => result.current[1]('monthly'));
    expect(result.current[0]).toBe('monthly');
    expect(localStorage.getItem('viewMode.payments')).toBe('monthly');
  });
});
