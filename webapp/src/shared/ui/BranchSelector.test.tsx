import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { BranchSelector, type BranchOption } from './BranchSelector';

const BRANCHES: BranchOption[] = [
  { key: 'central', name: 'Filiala Centrală' },
  { key: 'nord', name: 'Filiala Nord' },
];

describe('BranchSelector', () => {
  it('arată numele filialei selectate pe declanșator', () => {
    render(<BranchSelector branches={BRANCHES} selectedKey="nord" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Filiala Nord/ })).toBeInTheDocument();
  });

  it('deschide lista de filiale la clic pe declanșator', async () => {
    const user = userEvent.setup();
    render(<BranchSelector branches={BRANCHES} selectedKey="central" onChange={() => {}} />);

    expect(screen.queryByText('Filiala Nord')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Filiala Centrală/ }));

    expect(screen.getByText('Filiala Nord')).toBeInTheDocument();
  });

  it('clic pe o filială cheamă onChange și închide lista', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BranchSelector branches={BRANCHES} selectedKey="central" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Filiala Centrală/ }));
    await user.click(screen.getByText('Filiala Nord'));

    expect(onChange).toHaveBeenCalledWith('nord');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<BranchSelector branches={BRANCHES} selectedKey="central" onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
