import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { TodoCard } from './TodoCard';

describe('TodoCard', () => {
  it('randează titlul și detaliul', () => {
    render(<TodoCard title="Certificate medicale expirate" detail="3 copii" />);
    expect(screen.getByText('Certificate medicale expirate')).toBeInTheDocument();
    expect(screen.getByText('3 copii')).toBeInTheDocument();
  });

  it('apelează onClick la apăsare când e dat', async () => {
    const onClick = vi.fn();
    render(<TodoCard title="Certificate medicale expirate" onClick={onClick} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Certificate medicale expirate/ }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('randează un element neapăsabil fără onClick', () => {
    render(<TodoCard title="Certificate medicale expirate" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <TodoCard title="Certificate medicale expirate" detail="3 copii" onClick={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
