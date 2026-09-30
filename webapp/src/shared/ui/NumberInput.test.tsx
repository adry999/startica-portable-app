import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NumberInput } from './NumberInput';

describe('NumberInput', () => {
  it('apelează onChange cu valoarea introdusă', async () => {
    const onChange = vi.fn();
    render(<NumberInput value="" onChange={onChange} ariaLabel="Sumă" />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Sumă'), '5');

    expect(onChange).toHaveBeenCalledWith('5');
  });

  it('e un input numeric, fără săgeți native, cu min/step aplicate', () => {
    render(<NumberInput value="" onChange={() => {}} ariaLabel="Sumă" min={0} step="0.01" />);
    const input = screen.getByLabelText('Sumă');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('step', '0.01');
  });

  it('arată sufixul dat', () => {
    render(<NumberInput value="150" onChange={() => {}} ariaLabel="Sumă" suffix="lei" />);
    expect(screen.getByText('lei')).toBeInTheDocument();
  });

  it('marchează eroarea prin aria-invalid', () => {
    render(<NumberInput value="" onChange={() => {}} ariaLabel="Sumă" invalid />);
    expect(screen.getByLabelText('Sumă')).toHaveAttribute('aria-invalid', 'true');
  });

  it('e dezactivat cât `disabled` e adevărat', () => {
    render(<NumberInput value="" onChange={() => {}} ariaLabel="Sumă" disabled />);
    expect(screen.getByLabelText('Sumă')).toBeDisabled();
  });
});
