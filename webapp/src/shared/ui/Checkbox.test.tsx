import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('arată starea prin aria-checked', () => {
    render(<Checkbox checked={true} onChange={() => {}} ariaLabel="Trimite SMS" />);
    expect(screen.getByRole('checkbox', { name: 'Trimite SMS' })).toHaveAttribute('aria-checked', 'true');
  });

  it('apelează onChange cu valoarea inversată la click', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} ariaLabel="Trimite SMS" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox', { name: 'Trimite SMS' }));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('nu răspunde la click cât e dezactivată', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} ariaLabel="Trimite SMS" disabled />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox', { name: 'Trimite SMS' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
