import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChildFormDrawer } from './ChildFormDrawer';

describe('ChildFormDrawer', () => {
  it('nu randează nimic când target este null', () => {
    render(<ChildFormDrawer target={null} groups={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('arată câmpurile și butonul de salvare pentru un copil nou', () => {
    render(<ChildFormDrawer target="new" groups={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Nume copil')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvează' })).toBeInTheDocument();
  });

  it('trimite valorile completate la click pe Salvează', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ChildFormDrawer target="new" groups={[]} onSubmit={onSubmit} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Nume copil'), 'Ana Popescu');
    await userEvent.type(screen.getByLabelText('Părinte 1'), 'Maria Popescu');
    await userEvent.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana Popescu' }));
  });

  it('trimite formularul la submit (echivalent cu Enter într-un câmp)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<ChildFormDrawer target="new" groups={[]} onSubmit={onSubmit} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Nume copil'), 'Ana Popescu');
    await userEvent.type(screen.getByLabelText('Părinte 1'), 'Maria Popescu');
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
    await userEvent.type(screen.getByLabelText('Părinte 1'), 'Maria Popescu');
    const saveButton = screen.getByRole('button', { name: 'Salvează' });

    await userEvent.click(saveButton);
    await userEvent.click(saveButton);
    resolveSubmit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
