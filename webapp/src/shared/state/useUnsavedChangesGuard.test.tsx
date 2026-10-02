import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { readDirtyForms } from './dirty-forms';
import { diffChangedFields, useUnsavedChangesGuard } from './useUnsavedChangesGuard';

function TestHost({
  dirty,
  save,
  onClose,
  changedFields,
}: {
  dirty: boolean;
  save: () => Promise<boolean>;
  onClose: () => void;
  changedFields?: string[];
}) {
  const guard = useUnsavedChangesGuard({
    dirty,
    label: 'o cheltuială',
    formName: 'cheltuiala',
    changedFields,
    save,
    onClose,
  });
  return (
    <>
      <button onClick={guard.requestClose}>cere-închiderea</button>
      {guard.confirmDialog}
    </>
  );
}

describe('useUnsavedChangesGuard', () => {
  it('fără modificări, requestClose cheamă direct onClose', async () => {
    const onClose = vi.fn();
    render(<TestHost dirty={false} save={vi.fn()} onClose={onClose} />);
    await userEvent.click(screen.getByText('cere-închiderea'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cu modificări, requestClose arată dialogul în loc să închidă', async () => {
    const onClose = vi.fn();
    render(<TestHost dirty save={vi.fn()} onClose={onClose} changedFields={['nume']} />);
    await userEvent.click(screen.getByText('cere-închiderea'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Renunți la modificările din cheltuiala?' })).toBeInTheDocument();
    expect(screen.getByText('Câmpuri modificate: nume.')).toBeInTheDocument();
  });

  it('„Renunță” cheamă onClose', async () => {
    const onClose = vi.fn();
    render(<TestHost dirty save={vi.fn()} onClose={onClose} />);
    await userEvent.click(screen.getByText('cere-închiderea'));
    await userEvent.click(screen.getByRole('button', { name: 'Renunță' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('„Rămân” nu cheamă onClose și închide dialogul', async () => {
    const onClose = vi.fn();
    render(<TestHost dirty save={vi.fn()} onClose={onClose} />);
    await userEvent.click(screen.getByText('cere-închiderea'));
    await userEvent.click(screen.getByRole('button', { name: 'Rămân' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Renunți la modificările din cheltuiala?' })).not.toBeInTheDocument();
  });

  it('„Salvez și continui” salvează, apoi cheamă onClose doar dacă save() a reușit', async () => {
    const onClose = vi.fn();
    const save = vi.fn().mockResolvedValue(false);
    render(<TestHost dirty save={save} onClose={onClose} />);
    await userEvent.click(screen.getByText('cere-închiderea'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvez și continui' }));
    expect(save).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Renunți la modificările din cheltuiala?' })).toBeInTheDocument();
  });

  it('se înregistrează în registrul useDirtyForm cât timp dirty e adevărat', () => {
    render(<TestHost dirty save={vi.fn()} onClose={vi.fn()} changedFields={['nume']} />);
    expect(readDirtyForms()).toEqual([{ label: 'o cheltuială', save: expect.any(Function), changedFields: ['nume'] }]);
  });
});

describe('diffChangedFields', () => {
  it('întoarce etichetele câmpurilor schimbate, în ordinea din `labels`', () => {
    const changed = diffChangedFields(
      { name: 'Ion', age: 5, note: 'x' },
      { name: 'Ion', age: 4, note: 'x' },
      { name: 'nume', age: 'vârstă', note: 'notă' },
    );
    expect(changed).toEqual(['vârstă']);
  });

  it('ignoră cheile fără etichetă în `labels`', () => {
    const changed = diffChangedFields({ id: 'a', name: 'X' } as const, { id: 'b', name: 'X' } as const, {
      name: 'nume',
    });
    expect(changed).toEqual([]);
  });
});
