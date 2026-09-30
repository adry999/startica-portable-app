import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextInput } from './TextInput';

describe('TextInput', () => {
  it('apelează onChange cu valoarea introdusă', async () => {
    const onChange = vi.fn();
    render(<TextInput value="" onChange={onChange} ariaLabel="Nume" />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Nume'), 'A');

    expect(onChange).toHaveBeenCalledWith('A');
  });

  it('marchează eroarea prin aria-invalid', () => {
    render(<TextInput value="" onChange={() => {}} ariaLabel="Nume" invalid />);
    expect(screen.getByLabelText('Nume')).toHaveAttribute('aria-invalid', 'true');
  });

  it('e dezactivat cât `disabled` e adevărat', () => {
    render(<TextInput value="" onChange={() => {}} ariaLabel="Nume" disabled />);
    expect(screen.getByLabelText('Nume')).toBeDisabled();
  });
});
