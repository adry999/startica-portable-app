import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectionBar } from './SelectionBar';

describe('SelectionBar', () => {
  it('randează label-ul și cheamă onClick pe o acțiune', async () => {
    const onClick = vi.fn();
    render(<SelectionBar label="3 selectați" actions={[{ label: 'Exportă', onClick }]} />);

    expect(screen.getByText('3 selectați')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText('Exportă'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('acțiunea danger e separată de restul și cheamă propriul onClick', async () => {
    const onDanger = vi.fn();
    const onAction = vi.fn();
    render(
      <SelectionBar
        label="2 selectate"
        actions={[{ label: 'Arhivează', onClick: onAction }]}
        danger={{ label: 'Șterge definitiv', onClick: onDanger }}
      />,
    );

    await userEvent.setup().click(screen.getByText('Șterge definitiv'));
    expect(onDanger).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('onCancel randează butonul Anulează și e opțional', async () => {
    const onCancel = vi.fn();
    const { rerender } = render(<SelectionBar label="1 selectat" onCancel={onCancel} />);
    await userEvent.setup().click(screen.getByText('Anulează'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(<SelectionBar label="1 selectat" />);
    expect(screen.queryByText('Anulează')).not.toBeInTheDocument();
  });

  it('o acțiune disabled nu declanșează onClick', async () => {
    const onClick = vi.fn();
    render(<SelectionBar label="1 selectat" actions={[{ label: 'Exportă', onClick, disabled: true }]} />);
    await userEvent.setup().click(screen.getByText('Exportă'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
