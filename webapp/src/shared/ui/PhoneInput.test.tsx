import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PhoneInput } from './PhoneInput';

describe('PhoneInput', () => {
  it('apelează onChange cu valoarea introdusă', async () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} ariaLabel="Telefon" />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Telefon'), '0');

    expect(onChange).toHaveBeenCalledWith('0');
  });

  it('nu arată niciun mesaj cât câmpul e gol', () => {
    render(<PhoneInput value="" onChange={() => {}} ariaLabel="Telefon" />);
    expect(screen.queryByText(/\+373/)).not.toBeInTheDocument();
    expect(screen.queryByText('Numărul nu e un mobil moldovenesc valid.')).not.toBeInTheDocument();
  });

  it('arată confirmarea E.164 pentru un număr valid', () => {
    render(<PhoneInput value="069123456" onChange={() => {}} ariaLabel="Telefon" />);
    expect(screen.getByText('+37369123456')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefon')).not.toHaveAttribute('aria-invalid');
  });

  it('arată eroarea și aria-invalid pentru un număr nevalid', () => {
    render(<PhoneInput value="123" onChange={() => {}} ariaLabel="Telefon" />);
    expect(screen.getByText('Numărul nu e un mobil moldovenesc valid.')).toBeInTheDocument();
    expect(screen.getByLabelText('Telefon')).toHaveAttribute('aria-invalid', 'true');
  });

  it('e dezactivat cât `disabled` e adevărat', () => {
    render(<PhoneInput value="" onChange={() => {}} ariaLabel="Telefon" disabled />);
    expect(screen.getByLabelText('Telefon')).toBeDisabled();
  });

  // F4 (FEEDBACK-01-10.md): fără autocompletare de browser.
  it('are autoComplete="off"', () => {
    render(<PhoneInput value="" onChange={() => {}} ariaLabel="Telefon" />);
    expect(screen.getByLabelText('Telefon')).toHaveAttribute('autocomplete', 'off');
  });
});
