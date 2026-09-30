import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { AvatarGroup } from './AvatarGroup';

const ITEMS = [
  { name: 'Ionescu Maria' },
  { name: 'Popescu Andrei' },
  { name: 'Rusu Ana' },
  { name: 'Marin Elena' },
  { name: 'Coceva Alisa' },
];

describe('AvatarGroup', () => {
  it('randează un Avatar pentru fiecare element sub maxVisible', () => {
    render(<AvatarGroup items={ITEMS.slice(0, 3)} maxVisible={4} />);
    expect(screen.getByText('IM')).toBeInTheDocument();
    expect(screen.getByText('PA')).toBeInTheDocument();
    expect(screen.getByText('RA')).toBeInTheDocument();
  });

  it('comprimă restul într-un indicator "+N" peste maxVisible', () => {
    render(<AvatarGroup items={ITEMS} maxVisible={3} />);
    expect(screen.getByText('IM')).toBeInTheDocument();
    expect(screen.getByText('PA')).toBeInTheDocument();
    expect(screen.getByText('RA')).toBeInTheDocument();
    expect(screen.queryByText('ME')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('nu arată indicatorul de overflow când toate elementele încap', () => {
    render(<AvatarGroup items={ITEMS.slice(0, 2)} maxVisible={4} />);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<AvatarGroup items={ITEMS} maxVisible={3} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
