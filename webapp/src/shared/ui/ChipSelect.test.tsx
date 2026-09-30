import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChipSelect } from './ChipSelect';

const OPTIONS = [
  { value: 'lu', label: 'Lu' },
  { value: 'ma', label: 'Ma' },
  { value: 'mi', label: 'Mi', disabled: true },
] as const;

describe('ChipSelect', () => {
  it('marchează opțiunea selectată prin aria-checked', () => {
    render(<ChipSelect options={OPTIONS} value="lu" onChange={() => {}} ariaLabel="Zile" />);
    expect(screen.getByRole('radio', { name: 'Lu' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Ma' })).toHaveAttribute('aria-checked', 'false');
  });

  it('apelează onChange cu valoarea aleasă la click', async () => {
    const onChange = vi.fn();
    render(<ChipSelect options={OPTIONS} value="lu" onChange={onChange} ariaLabel="Zile" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: 'Ma' }));

    expect(onChange).toHaveBeenCalledWith('ma');
  });

  it('dezactivează opțiunile marcate `disabled`', () => {
    render(<ChipSelect options={OPTIONS} value="lu" onChange={() => {}} ariaLabel="Zile" />);
    expect(screen.getByRole('radio', { name: 'Mi' })).toBeDisabled();
  });
});
