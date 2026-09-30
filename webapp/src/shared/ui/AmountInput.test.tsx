import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AmountInput } from './AmountInput';

describe('AmountInput', () => {
  it('apelează onChange cu valoarea introdusă', async () => {
    const onChange = vi.fn();
    render(<AmountInput value="" onChange={onChange} ariaLabel="Sumă" />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Sumă'), '5');

    expect(onChange).toHaveBeenCalledWith('5');
  });

  it('arată moneda dată', () => {
    render(<AmountInput value="150" onChange={() => {}} ariaLabel="Sumă" currency="lei" />);
    expect(screen.getByText('lei')).toBeInTheDocument();
  });

  it('arată pastilele de scurtătură când sunt date', () => {
    render(
      <AmountInput
        value=""
        onChange={() => {}}
        ariaLabel="Sumă"
        shortcuts={<button type="button">1 lună · 9.600</button>}
      />,
    );
    expect(screen.getByRole('button', { name: '1 lună · 9.600' })).toBeInTheDocument();
  });

  it('e dezactivat cât `disabled` e adevărat', () => {
    render(<AmountInput value="" onChange={() => {}} ariaLabel="Sumă" disabled />);
    expect(screen.getByLabelText('Sumă')).toBeDisabled();
  });
});
