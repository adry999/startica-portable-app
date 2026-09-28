import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('arată starea prin aria-checked', () => {
    render(<Toggle checked={true} onChange={() => {}} ariaLabel="Restanțe" />);
    expect(screen.getByRole('switch', { name: 'Restanțe' })).toHaveAttribute('aria-checked', 'true');
  });

  it('apelează onChange cu valoarea inversată la click', async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} ariaLabel="Zile de naștere" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('switch', { name: 'Zile de naștere' }));

    expect(onChange).toHaveBeenCalledWith(true);
  });
});
