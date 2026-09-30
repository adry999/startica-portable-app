import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { TaskRow } from './TaskRow';

describe('TaskRow', () => {
  it('randează eticheta și meta', () => {
    render(<TaskRow label="Trimite notificare părinți" done={false} meta="Scadent azi" onToggle={() => {}} />);
    expect(screen.getByText('Trimite notificare părinți')).toBeInTheDocument();
    expect(screen.getByText('Scadent azi')).toBeInTheDocument();
  });

  it('apelează onToggle cu valoarea inversată la click pe bifă', async () => {
    const onToggle = vi.fn();
    render(<TaskRow label="Trimite notificare părinți" done={false} onToggle={onToggle} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox', { name: 'Trimite notificare părinți' }));

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('arată eticheta tăiată când e rezolvat', () => {
    render(<TaskRow label="Trimite notificare părinți" done={true} onToggle={() => {}} />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <TaskRow label="Trimite notificare părinți" done={false} meta="Scadent azi" onToggle={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
