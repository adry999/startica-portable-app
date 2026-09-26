import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GroupFormDrawer } from './GroupFormDrawer';

describe('GroupFormDrawer', () => {
  it('nu randează nimic când e închis', () => {
    render(<GroupFormDrawer open={false} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('arată câmpurile și butonul de salvare când e deschis', () => {
    render(<GroupFormDrawer open onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Nume grupă')).toBeInTheDocument();
    expect(screen.getByLabelText('Capacitate')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvează' })).toBeInTheDocument();
  });

  it('trimite numele și capacitatea completate la click pe Salvează', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GroupFormDrawer open onSubmit={onSubmit} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Nume grupă'), 'Pinguini');
    await userEvent.type(screen.getByLabelText('Capacitate'), '6');
    await userEvent.click(screen.getByRole('button', { name: 'Salvează' }));

    expect(onSubmit).toHaveBeenCalledWith('Pinguini', '6');
  });

  it('trimite formularul la submit (echivalent cu Enter într-un câmp)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<GroupFormDrawer open onSubmit={onSubmit} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Nume grupă'), 'Pinguini');
    await userEvent.type(screen.getByLabelText('Capacitate'), '6');
    fireEvent.submit(container.querySelector('form')!);

    expect(onSubmit).toHaveBeenCalledWith('Pinguini', '6');
  });

  it('apelează onSubmit o singură dată la dublu-click rapid pe Salvează', async () => {
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveSubmit = resolve;
        }),
    );
    render(<GroupFormDrawer open onSubmit={onSubmit} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Nume grupă'), 'Pinguini');
    const saveButton = screen.getByRole('button', { name: 'Salvează' });

    await userEvent.click(saveButton);
    await userEvent.click(saveButton);
    resolveSubmit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('pornește cu câmpuri goale la redeschidere după închidere', async () => {
    const { rerender } = render(<GroupFormDrawer open onSubmit={vi.fn()} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Nume grupă'), 'Pinguini');

    rerender(<GroupFormDrawer open={false} onSubmit={vi.fn()} onClose={vi.fn()} />);
    rerender(<GroupFormDrawer open onSubmit={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByLabelText('Nume grupă')).toHaveValue('');
    expect(screen.getByLabelText('Capacitate')).toHaveValue(null);
  });
});
