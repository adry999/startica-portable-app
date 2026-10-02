import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

describe('ConfirmDeleteDialog', () => {
  it('nu randează nimic când open e false', () => {
    render(
      <ConfirmDeleteDialog
        open={false}
        title="Șterge copilul"
        description="Ireversibil."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('butonul de confirmare rămâne dezactivat până se scrie exact cuvântul cerut', async () => {
    render(
      <ConfirmDeleteDialog
        open
        title="Șterge copilul"
        description="Ireversibil."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const user = userEvent.setup();
    const confirmButton = screen.getByRole('button', { name: 'Șterge definitiv' });
    const input = screen.getByLabelText('Scrie ȘTERGE pentru confirmare');

    expect(confirmButton).toBeDisabled();
    await user.type(input, 'sterge');
    expect(confirmButton).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'ȘTERGE');
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
  });

  it('un confirmWord/confirmLabel personalizat se folosește peste tot', () => {
    render(
      <ConfirmDeleteDialog
        open
        title="Șterge copiii"
        description="3 copii selectați."
        confirmWord="DA"
        confirmLabel="Șterge 3 copii"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByLabelText('Scrie DA pentru confirmare')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Șterge 3 copii' })).toBeInTheDocument();
  });

  it('Escape cheamă onCancel', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDeleteDialog
        open
        title="Șterge copilul"
        description="Ireversibil."
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    await userEvent.setup().keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('un click pe overlay cheamă onCancel, dar un click în interiorul dialogului nu', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDeleteDialog
        open
        title="Șterge copilul"
        description="Ireversibil."
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByText('Ireversibil.'));
    expect(onCancel).not.toHaveBeenCalled();

    await user.click(screen.getByRole('alertdialog').parentElement!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
