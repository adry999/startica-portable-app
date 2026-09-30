import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PrintOptionsDialog } from './PrintOptionsDialog';

describe('PrintOptionsDialog', () => {
  it('nu randează nimic când e închis', () => {
    render(<PrintOptionsDialog open={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('trimite implicitele (filtrul curent, cu telefon, orizontal) când se apasă Tipărește direct', async () => {
    const onConfirm = vi.fn();
    render(<PrintOptionsDialog open={true} onCancel={vi.fn()} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('button', { name: 'Tipărește' }));

    expect(onConfirm).toHaveBeenCalledWith({ scope: 'filtered', showPhone: true, orientation: 'landscape' });
  });

  it('permite schimbarea celor trei opțiuni', async () => {
    const onConfirm = vi.fn();
    render(<PrintOptionsDialog open={true} onCancel={vi.fn()} onConfirm={onConfirm} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: 'Toți copiii' }));
    await user.click(screen.getByLabelText('Cu telefon')); // dezactivează
    await user.click(screen.getByRole('radio', { name: 'Vertical' }));
    await user.click(screen.getByRole('button', { name: 'Tipărește' }));

    expect(onConfirm).toHaveBeenCalledWith({ scope: 'all', showPhone: false, orientation: 'portrait' });
  });

  it('Anulează închide fără să trimită opțiunile', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<PrintOptionsDialog open={true} onCancel={onCancel} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('button', { name: 'Anulează' }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
