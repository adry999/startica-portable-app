import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RowMenu } from './RowMenu';

describe('RowMenu', () => {
  it('deschide meniul și cheamă onClick la alegerea unui item', async () => {
    const onClick = vi.fn();
    render(<RowMenu items={[{ label: 'Arhivează', onClick }]} />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Mai multe acțiuni'));
    await user.click(screen.getByText('Arhivează'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('un item disabled nu declanșează onClick', async () => {
    const onClick = vi.fn();
    render(<RowMenu items={[{ label: 'Șterge', onClick, disabled: true }]} />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Mai multe acțiuni'));
    await user.click(screen.getByText('Șterge'));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('un item danger primește clasa de avertizare', async () => {
    render(<RowMenu items={[{ label: 'Șterge definitiv', onClick: () => {}, danger: true }]} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Mai multe acțiuni'));

    expect(screen.getByText('Șterge definitiv').className).toMatch(/rowMenuDanger|danger/i);
  });

  it('un click pe meniu nu propagă la rândul din spate (stopPropagation)', async () => {
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <RowMenu items={[{ label: 'Editează', onClick: () => {} }]} />
      </div>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Mai multe acțiuni'));

    expect(onRowClick).not.toHaveBeenCalled();
  });
});
