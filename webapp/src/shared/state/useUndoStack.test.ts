import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useUndoStack } from './useUndoStack';

describe('useUndoStack', () => {
  it('nu are nimic de anulat la pornire', () => {
    const onRestore = vi.fn();
    const { result } = renderHook(() => useUndoStack<string>('a', onRestore));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.history).toEqual([]);
  });

  it('undoLast restaurează starea de dinainte a ultimei intrări', () => {
    const onRestore = vi.fn();
    const { result } = renderHook(() => useUndoStack<string>('a', onRestore));

    act(() => result.current.push('primul', new Map([['k1', 'prev1']])));
    act(() => result.current.push('al doilea', new Map([['k1', 'după primul']])));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.history.map(entry => entry.label)).toEqual(['al doilea', 'primul']);

    act(() => result.current.undoLast());
    expect(onRestore).toHaveBeenCalledWith(new Map([['k1', 'după primul']]));
    expect(result.current.history.map(entry => entry.label)).toEqual(['primul']);
  });

  it('undoUntil anulează intrarea și tot ce a venit după ea, păstrând cea mai veche valoare per cheie', () => {
    const onRestore = vi.fn();
    const { result } = renderHook(() => useUndoStack<string>('a', onRestore));

    act(() => result.current.push('primul', new Map([['k1', 'inițial']])));
    act(() => result.current.push('al doilea', new Map([['k1', 'după primul']])));
    act(() => result.current.push('al treilea', new Map([['k2', 'inițial k2']])));

    const middleId = result.current.history.find(entry => entry.label === 'al doilea')!.id;
    act(() => result.current.undoUntil(middleId));

    // „al doilea" nu e chiar prima atingere a lui k1 (asta e „primul") — undoUntil desface doar
    // de la „al doilea" încolo, deci k1 revine la ce era ÎNAINTE de „al doilea" („după primul").
    expect(onRestore).toHaveBeenCalledWith(
      new Map([
        ['k1', 'după primul'],
        ['k2', 'inițial k2'],
      ]),
    );
    expect(result.current.history.map(entry => entry.label)).toEqual(['primul']);
  });

  it('undoAll golește istoricul și restaurează toate cheile atinse', () => {
    const onRestore = vi.fn();
    const { result } = renderHook(() => useUndoStack<string>('a', onRestore));

    act(() => result.current.push('primul', new Map([['k1', 'inițial']])));
    act(() => result.current.push('al doilea', new Map([['k2', 'inițial k2']])));
    act(() => result.current.undoAll());

    expect(onRestore).toHaveBeenCalledWith(
      new Map([
        ['k1', 'inițial'],
        ['k2', 'inițial k2'],
      ]),
    );
    expect(result.current.canUndo).toBe(false);
    expect(result.current.history).toEqual([]);
  });

  it('golește istoricul când resetKey se schimbă', () => {
    const onRestore = vi.fn();
    const { result, rerender } = renderHook(({ key }: { key: string }) => useUndoStack<string>(key, onRestore), {
      initialProps: { key: 'a' },
    });

    act(() => result.current.push('primul', new Map([['k1', 'inițial']])));
    expect(result.current.canUndo).toBe(true);

    rerender({ key: 'b' });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.history).toEqual([]);
  });

  it('nu apelează onRestore când nu are ce anula', () => {
    const onRestore = vi.fn();
    const { result } = renderHook(() => useUndoStack<string>('a', onRestore));

    act(() => result.current.undoLast());
    act(() => result.current.undoAll());
    act(() => result.current.undoUntil('inexistent'));

    expect(onRestore).not.toHaveBeenCalled();
  });
});
