import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DateInput } from './DateInput';

describe('DateInput', () => {
  it('apelează onChange cu valoarea introdusă', async () => {
    const onChange = vi.fn();
    render(<DateInput value="" onChange={onChange} ariaLabel="Data" />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Data'), '2026-09-30');

    expect(onChange).toHaveBeenCalled();
    expect(screen.getByLabelText('Data')).toHaveAttribute('type', 'date');
  });

  it('arată textul opțional `trailing`', () => {
    render(<DateInput value="2020-01-01" onChange={() => {}} ariaLabel="Naștere" trailing="4 ani" />);
    expect(screen.getByText('4 ani')).toBeInTheDocument();
  });

  it('marchează eroarea prin aria-invalid', () => {
    render(<DateInput value="" onChange={() => {}} ariaLabel="Data" invalid />);
    expect(screen.getByLabelText('Data')).toHaveAttribute('aria-invalid', 'true');
  });

  it('e dezactivat cât `disabled` e adevărat', () => {
    render(<DateInput value="" onChange={() => {}} ariaLabel="Data" disabled />);
    expect(screen.getByLabelText('Data')).toBeDisabled();
  });

  // F4 (FEEDBACK-01-10.md): fără autocompletare de browser.
  it('are autoComplete="off"', () => {
    render(<DateInput value="" onChange={() => {}} ariaLabel="Data" />);
    expect(screen.getByLabelText('Data')).toHaveAttribute('autocomplete', 'off');
  });
});
