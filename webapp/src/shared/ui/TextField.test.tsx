import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextField } from './TextField';

describe('TextField', () => {
  it('arată valoarea primită', () => {
    render(<TextField value="Elena" onChange={() => {}} ariaLabel="Nume" />);
    expect(screen.getByRole('textbox', { name: 'Nume' })).toHaveValue('Elena');
  });

  it('apelează onChange cu textul introdus', async () => {
    const onChange = vi.fn();
    render(<TextField value="" onChange={onChange} ariaLabel="Nume" />);
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: 'Nume' }), 'a');

    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('marchează aria-invalid când e invalid', () => {
    render(<TextField value="123" onChange={() => {}} ariaLabel="Telefon" invalid />);
    expect(screen.getByRole('textbox', { name: 'Telefon' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('nu răspunde la tastare cât e dezactivat', () => {
    render(<TextField value="" onChange={() => {}} ariaLabel="Nume" disabled />);
    expect(screen.getByRole('textbox', { name: 'Nume' })).toBeDisabled();
  });
});
