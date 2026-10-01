import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TimeInput } from './TimeInput';

describe('TimeInput', () => {
  it('apelează onChange cu valoarea introdusă', async () => {
    const onChange = vi.fn();
    render(<TimeInput value="" onChange={onChange} ariaLabel="Ora" />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Ora'), '09:30');

    expect(onChange).toHaveBeenCalled();
    expect(screen.getByLabelText('Ora')).toHaveAttribute('type', 'time');
  });

  it('arată textul opțional `trailing`', () => {
    render(<TimeInput value="09:00" onChange={() => {}} ariaLabel="De la" trailing="dimineața" />);
    expect(screen.getByText('dimineața')).toBeInTheDocument();
  });

  // F4 (FEEDBACK-01-10.md): fără autocompletare de browser.
  it('are autoComplete="off"', () => {
    render(<TimeInput value="" onChange={() => {}} ariaLabel="Ora" />);
    expect(screen.getByLabelText('Ora')).toHaveAttribute('autocomplete', 'off');
  });
});
