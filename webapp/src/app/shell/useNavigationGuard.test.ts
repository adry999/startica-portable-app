import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDirtyForm } from '@shared/state/dirty-forms';
import type { ViewKey } from './nav-items';
import { useNavigationGuard } from './useNavigationGuard';

describe('useNavigationGuard — 40c: navigarea în alt modul cu formular nesalvat', () => {
  it('fără formular nesalvat, navighează direct', () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useNavigationGuard('children' as ViewKey, navigate));
    act(() => result.current.guardedNavigate('payments' as ViewKey));
    expect(navigate).toHaveBeenCalledWith('payments', undefined);
    expect(result.current.pending).toBeNull();
  });

  it('spre același modul, navighează direct chiar cu formular nesalvat', () => {
    const navigate = vi.fn();
    const { result: dirtyForm } = renderHook(() =>
      useDirtyForm({ label: 'o achitare', save: vi.fn(async () => true) }),
    );
    void dirtyForm;
    const { result } = renderHook(() => useNavigationGuard('payments' as ViewKey, navigate));
    act(() => result.current.guardedNavigate('payments' as ViewKey));
    expect(navigate).toHaveBeenCalledWith('payments', undefined);
  });

  it('cu formular nesalvat, navigarea spre alt modul cere confirmare', () => {
    const navigate = vi.fn();
    renderHook(() => useDirtyForm({ label: 'o achitare', save: vi.fn(async () => true) }));
    const { result } = renderHook(() => useNavigationGuard('payments' as ViewKey, navigate));

    act(() => result.current.guardedNavigate('children' as ViewKey));

    expect(navigate).not.toHaveBeenCalled();
    expect(result.current.pending?.view).toBe('children');
    expect(result.current.formName).toBe('achitare');
  });

  it('„Renunță” navighează spre modulul cerut', () => {
    const navigate = vi.fn();
    renderHook(() => useDirtyForm({ label: 'o achitare', save: vi.fn(async () => true) }));
    const { result } = renderHook(() => useNavigationGuard('payments' as ViewKey, navigate));

    act(() => result.current.guardedNavigate('children' as ViewKey));
    act(() => result.current.discardAndNavigate());

    expect(navigate).toHaveBeenCalledWith('children', undefined);
    expect(result.current.pending).toBeNull();
  });

  it('„Rămân” nu navighează', () => {
    const navigate = vi.fn();
    renderHook(() => useDirtyForm({ label: 'o achitare', save: vi.fn(async () => true) }));
    const { result } = renderHook(() => useNavigationGuard('payments' as ViewKey, navigate));

    act(() => result.current.guardedNavigate('children' as ViewKey));
    act(() => result.current.stay());

    expect(navigate).not.toHaveBeenCalled();
    expect(result.current.pending).toBeNull();
  });

  it('„Salvez și continui” salvează, apoi navighează doar dacă save() a reușit', async () => {
    const navigate = vi.fn();
    const save = vi.fn().mockResolvedValue(true);
    renderHook(() => useDirtyForm({ label: 'o achitare', save }));
    const { result } = renderHook(() => useNavigationGuard('payments' as ViewKey, navigate));

    act(() => result.current.guardedNavigate('children' as ViewKey));
    await act(async () => result.current.saveAndNavigate());

    expect(save).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('children', undefined);
  });
});
