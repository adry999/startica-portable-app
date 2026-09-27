import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readDirtyForms, useDirtyForm, type DirtyForm } from './dirty-forms';

describe('dirty-forms', () => {
  it('un formular modificat se înregistrează și dispare la demontare', () => {
    const form: DirtyForm = { label: 'o achitare', save: vi.fn(async () => true) };
    const { unmount, rerender } = renderHook<void, { current: DirtyForm | null }>(({ current }) => useDirtyForm(current), {
      initialProps: { current: form },
    });

    expect(readDirtyForms()).toEqual([{ label: 'o achitare', save: expect.any(Function) }]);

    rerender({ current: null });
    expect(readDirtyForms()).toEqual([]);

    rerender({ current: form });
    expect(readDirtyForms()).toHaveLength(1);
    unmount();
    expect(readDirtyForms()).toEqual([]);
  });

  it('save() apelează mereu ultima funcție de salvare, chiar dacă formularul nu s-a reînregistrat', async () => {
    const firstSave = vi.fn(async () => true);
    const secondSave = vi.fn(async () => true);
    const { rerender } = renderHook(({ save }: { save: () => Promise<boolean> }) => useDirtyForm({ label: 'o cheltuială', save }), {
      initialProps: { save: firstSave },
    });

    rerender({ save: secondSave });

    const [entry] = readDirtyForms();
    await entry.save();
    expect(firstSave).not.toHaveBeenCalled();
    expect(secondSave).toHaveBeenCalledTimes(1);
  });

  it('nu înregistrează nimic când formularul e null', () => {
    renderHook(() => useDirtyForm(null));
    expect(readDirtyForms()).toEqual([]);
  });
});
