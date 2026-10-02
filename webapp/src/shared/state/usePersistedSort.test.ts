import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePersistedSort } from './usePersistedSort';

describe('usePersistedSort', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('pornește cu sortarea implicită când nu există nimic salvat', () => {
    const { result } = renderHook(() => usePersistedSort('sort.payments', { key: 'date', direction: 'desc' }));
    expect(result.current[0]).toEqual({ key: 'date', direction: 'desc' });
  });

  it('citește sortarea deja salvată în localStorage', () => {
    localStorage.setItem('sort.payments', 'total:asc');
    const { result } = renderHook(() => usePersistedSort('sort.payments', { key: 'date', direction: 'desc' }));
    expect(result.current[0]).toEqual({ key: 'total', direction: 'asc' });
  });

  it('salvează noua sortare la schimbare', () => {
    const { result } = renderHook(() => usePersistedSort('sort.payments', { key: 'date', direction: 'desc' }));
    act(() => result.current[1]({ key: 'total', direction: 'asc' }));
    expect(result.current[0]).toEqual({ key: 'total', direction: 'asc' });
    expect(localStorage.getItem('sort.payments')).toBe('total:asc');
  });

  it('revine la sortarea implicită când DataTable trimite null', () => {
    const { result } = renderHook(() => usePersistedSort('sort.payments', { key: 'date', direction: 'desc' }));
    act(() => result.current[1]({ key: 'total', direction: 'asc' }));
    act(() => result.current[1](null));
    expect(result.current[0]).toEqual({ key: 'date', direction: 'desc' });
  });

  it('cade pe implicit dacă valoarea salvată e coruptă', () => {
    localStorage.setItem('sort.payments', 'ceva-nevalid');
    const { result } = renderHook(() => usePersistedSort('sort.payments', { key: 'date', direction: 'desc' }));
    expect(result.current[0]).toEqual({ key: 'date', direction: 'desc' });
  });
});
