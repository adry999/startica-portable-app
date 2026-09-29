import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextArea } from './TextArea';

describe('TextArea', () => {
  it('arată valoarea primită', () => {
    render(<TextArea value="Salut" onChange={() => {}} ariaLabel="Text liber" />);
    expect(screen.getByRole('textbox', { name: 'Text liber' })).toHaveValue('Salut');
  });

  it('apelează onChange cu textul introdus', async () => {
    const onChange = vi.fn();
    render(<TextArea value="" onChange={onChange} ariaLabel="Text liber" />);
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: 'Text liber' }), 'a');

    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('nu răspunde la tastare cât e dezactivat', () => {
    render(<TextArea value="" onChange={() => {}} ariaLabel="Text liber" disabled />);
    expect(screen.getByRole('textbox', { name: 'Text liber' })).toBeDisabled();
  });
});
