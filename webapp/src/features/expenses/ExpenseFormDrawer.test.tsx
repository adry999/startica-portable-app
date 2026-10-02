import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExpenseFormDrawer } from './ExpenseFormDrawer';

function renderDrawer() {
  const onSubmit = vi.fn().mockResolvedValue(true);
  const onSubmitAndAddAnother = vi.fn().mockResolvedValue(true);
  const onClose = vi.fn();
  render(
    <ExpenseFormDrawer
      target="new"
      categoryNames={['General', 'Hrană']}
      onSubmit={onSubmit}
      onSubmitAndAddAnother={onSubmitAndAddAnother}
      onClose={onClose}
    />,
  );
  return { onSubmit, onSubmitAndAddAnother, onClose };
}

function amountInput() {
  return screen.getByLabelText('Suma') as HTMLInputElement;
}

describe('ExpenseFormDrawer — 40c: confirmare la închidere cu modificări nesalvate', () => {
  it('fără modificări, × închide direct, fără dialog', async () => {
    const { onClose } = renderDrawer();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Închide' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByText(/^Renunți la modificările/)).not.toBeInTheDocument();
  });

  it('×, cu modificări nesalvate, arată UnsavedChangesDialog în loc să închidă', async () => {
    const { onClose } = renderDrawer();
    const user = userEvent.setup();
    await user.type(amountInput(), '150');

    await user.click(screen.getByRole('button', { name: 'Închide' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Renunți la modificările din cheltuiala nouă?' })).toBeInTheDocument();
    expect(screen.getByText('Câmpuri modificate: suma.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Renunță' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Esc, cu modificări nesalvate, arată dialogul — „Rămân” nu închide', async () => {
    const { onClose } = renderDrawer();
    const user = userEvent.setup();
    await user.type(amountInput(), '150');

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Renunți la modificările din cheltuiala nouă?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rămân' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clicul pe fundal, cu modificări nesalvate, arată dialogul în loc să închidă', async () => {
    const { onClose } = renderDrawer();
    const user = userEvent.setup();
    await user.type(amountInput(), '150');

    await user.click(screen.getByRole('dialog', { name: 'Adaugă: cheltuială' }).parentElement!);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Renunți la modificările din cheltuiala nouă?' })).toBeInTheDocument();
  });

  it('„Salvez și continui” salvează, apoi închide drawer-ul', async () => {
    const { onSubmit, onClose } = renderDrawer();
    const user = userEvent.setup();
    await user.type(amountInput(), '150');

    await user.click(screen.getByRole('button', { name: 'Închide' }));
    await user.click(screen.getByRole('button', { name: 'Salvez și continui' }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
