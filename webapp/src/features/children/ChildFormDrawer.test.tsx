import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { readDirtyForms } from '@shared/state/dirty-forms';
import { ChildFormDrawer } from './ChildFormDrawer';
import type { ChildRow } from './useChildren';
import type { Group } from '@contracts/record-types.mjs';

function row(overrides: Partial<ChildRow>): ChildRow {
  return {
    id: 'C-1',
    name: 'Copil',
    contractLabel: '',
    parent: '',
    phone: '',
    groupId: null,
    groupName: '',
    archived: false,
    status: 'Activ',
    dueDateLabel: '',
    payment: { tone: 'neutral', label: '' },
    child: {} as ChildRow['child'],
    ...overrides,
  };
}

describe('ChildFormDrawer', () => {
  it('nu randează nimic când target este null', () => {
    render(<ChildFormDrawer target={null} groups={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('arată câmpurile și butonul de salvare pentru un copil nou', () => {
    render(<ChildFormDrawer target="new" groups={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Nume copil')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvează copilul' })).toBeInTheDocument();
  });

  it('trimite valorile completate la click pe Salvează', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChildFormDrawer target="new" groups={[]} onSubmit={onSubmit} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Nume copil'), 'Ana Popescu');
    await userEvent.type(screen.getAllByLabelText('Nume')[0], 'Maria Popescu');
    await userEvent.click(screen.getByRole('button', { name: 'Salvează copilul' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana Popescu' }));
  });

  it('trimite formularul la submit (echivalent cu Enter într-un câmp)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<ChildFormDrawer target="new" groups={[]} onSubmit={onSubmit} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Nume copil'), 'Ana Popescu');
    await userEvent.type(screen.getAllByLabelText('Nume')[0], 'Maria Popescu');
    fireEvent.submit(container.querySelector('form')!);

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana Popescu' }));
  });

  it('apelează onSubmit o singură dată la dublu-click rapid pe Salvează', async () => {
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveSubmit = resolve;
        }),
    );
    render(<ChildFormDrawer target="new" groups={[]} onSubmit={onSubmit} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Nume copil'), 'Ana Popescu');
    await userEvent.type(screen.getAllByLabelText('Nume')[0], 'Maria Popescu');
    const saveButton = screen.getByRole('button', { name: 'Salvează copilul' });

    await userEvent.click(saveButton);
    await userEvent.click(saveButton);
    resolveSubmit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('formularul devine „nesalvat” după prima modificare și save() întoarce true la salvare reușită', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChildFormDrawer target="new" groups={[]} onSubmit={onSubmit} onClose={vi.fn()} />);

    expect(readDirtyForms()).toEqual([]);

    await userEvent.type(screen.getByLabelText('Nume copil'), 'Ana Popescu');

    const [dirtyForm] = readDirtyForms();
    expect(dirtyForm.label).toBe('o fișă de copil');

    await expect(dirtyForm.save()).resolves.toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('15a: chip-ul de grupă arată locurile libere și selectează grupa la click', async () => {
    const groups: Group[] = [{ id: 'G-1', name: 'Fluturași', capacity: 3, order: 1 }];
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ChildFormDrawer
        target="new"
        groups={groups}
        allChildren={[row({ id: 'C-2', groupId: 'G-1' })]}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    const chip = screen.getByRole('button', { name: /Fluturași/ });
    expect(chip).toHaveTextContent('2 locuri libere');

    await userEvent.click(chip);
    await userEvent.type(screen.getByLabelText('Nume copil'), 'Ana Popescu');
    await userEvent.type(screen.getAllByLabelText('Nume')[0], 'Maria Popescu');
    await userEvent.click(screen.getByRole('button', { name: 'Salvează copilul' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'G-1' }));
  });

  it('15a: nu numără copilul editat la locurile ocupate din grupa lui curentă', () => {
    const groups: Group[] = [{ id: 'G-1', name: 'Fluturași', capacity: 2, order: 1 }];
    const child = { id: 'C-1', name: 'Ana', groupId: 'G-1' } as unknown as import('@contracts/record-types.mjs').Child;
    render(
      <ChildFormDrawer
        target={child}
        groups={groups}
        allChildren={[row({ id: 'C-1', groupId: 'G-1' })]}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Fluturași/ })).toHaveTextContent('2 locuri libere');
  });

  it('15a: arată grupele compatibile cu vârsta calculată din data nașterii', async () => {
    const groups: Group[] = [
      { id: 'G-1', name: 'Fluturași', capacity: null, ageMinYears: 3, ageMaxYears: 4, order: 1 },
    ];
    render(<ChildFormDrawer target="new" groups={groups} onSubmit={vi.fn()} onClose={vi.fn()} />);

    expect(screen.queryByText('Grupe compatibile cu vârsta')).not.toBeInTheDocument();

    const fourYearsAgo = new Date();
    fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
    await userEvent.type(screen.getByLabelText(/Data nașterii/), fourYearsAgo.toISOString().slice(0, 10));

    expect(screen.getByText('Grupe compatibile cu vârsta')).toBeInTheDocument();
    expect(screen.getAllByText('Fluturași').length).toBeGreaterThanOrEqual(1);
  });
});
