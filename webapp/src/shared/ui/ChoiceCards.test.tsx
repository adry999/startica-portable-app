import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChoiceCards } from './ChoiceCards';

const OPTIONS = [
  { value: '10', title: '10:00', sub: '3 locuri' },
  { value: '11', title: '11:00', sub: 'Plin', disabled: true },
] as const;

describe('ChoiceCards', () => {
  it('marchează cardul selectat prin aria-checked', () => {
    render(<ChoiceCards options={OPTIONS} value="10" onChange={() => {}} ariaLabel="Ora" />);
    expect(screen.getByRole('radio', { name: /10:00/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /11:00/ })).toHaveAttribute('aria-checked', 'false');
  });

  it('apelează onChange cu valoarea aleasă la click', async () => {
    const onChange = vi.fn();
    render(<ChoiceCards options={OPTIONS} value="10" onChange={onChange} ariaLabel="Ora" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: /10:00/ }));

    expect(onChange).toHaveBeenCalledWith('10');
  });

  it('dezactivează cardul unei ore pline', () => {
    render(<ChoiceCards options={OPTIONS} value="10" onChange={() => {}} ariaLabel="Ora" />);
    expect(screen.getByRole('radio', { name: /11:00/ })).toBeDisabled();
  });
});
