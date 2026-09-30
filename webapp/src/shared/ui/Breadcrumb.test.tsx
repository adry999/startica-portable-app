import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Breadcrumb } from './Breadcrumb';

describe('Breadcrumb', () => {
  it('arată elementele intermediare ca linkuri și ultimul ca text curent', () => {
    render(<Breadcrumb items={[{ label: 'Copii', onClick: () => {} }, { label: 'Ionescu Maria' }]} />);

    expect(screen.getByRole('button', { name: 'Copii' })).toBeInTheDocument();
    expect(screen.getByText('Ionescu Maria')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'Ionescu Maria' })).not.toBeInTheDocument();
  });

  it('apelează onClick la clic pe un element intermediar', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Breadcrumb items={[{ label: 'Copii', onClick }, { label: 'Ionescu Maria' }]} />);

    await user.click(screen.getByRole('button', { name: 'Copii' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('randează nav cu eticheta corectă', () => {
    render(<Breadcrumb items={[{ label: 'Copii' }]} />);
    expect(screen.getByRole('navigation', { name: 'Fir de ariadnă' })).toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <Breadcrumb items={[{ label: 'Copii', onClick: () => {} }, { label: 'Ionescu Maria' }]} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
