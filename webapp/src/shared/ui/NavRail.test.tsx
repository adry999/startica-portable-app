import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { NavRail, type NavRailItem } from './NavRail';

function buildItems(onClick: (key: string) => void): NavRailItem[] {
  return [
    { key: 'dashboard', label: 'Dashboard', icon: 'menu', active: true, onClick: () => onClick('dashboard') },
    { key: 'copii', label: 'Copii', icon: 'search', onClick: () => onClick('copii') },
  ];
}

describe('NavRail', () => {
  it('randează toate elementele cu eticheta lor', () => {
    render(<NavRail items={buildItems(() => {})} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Copii')).toBeInTheDocument();
  });

  it('marchează elementul activ cu aria-current', () => {
    render(<NavRail items={buildItems(() => {})} />);
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Copii' })).not.toHaveAttribute('aria-current');
  });

  it('cheamă onClick la apăsarea unui element', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<NavRail items={buildItems(onClick)} />);
    await user.click(screen.getByRole('button', { name: 'Copii' }));
    expect(onClick).toHaveBeenCalledWith('copii');
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<NavRail items={buildItems(() => {})} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
