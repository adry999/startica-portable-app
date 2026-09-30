import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

const OPTIONS = [
  { value: 'mama', label: 'Mamă' },
  { value: 'tata', label: 'Tată' },
];

describe('Select', () => {
  it('apelează onChange cu valoarea aleasă', async () => {
    const onChange = vi.fn();
    render(<Select value="" onChange={onChange} options={OPTIONS} placeholder="—" ariaLabel="Relație" />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('Relație'), 'tata');

    expect(onChange).toHaveBeenCalledWith('tata');
  });

  it('arată opțiunea placeholder când valoarea e goală', () => {
    render(<Select value="" onChange={() => {}} options={OPTIONS} placeholder="—" ariaLabel="Relație" />);
    expect(screen.getByLabelText('Relație')).toHaveValue('');
  });

  it('marchează eroarea prin aria-invalid', () => {
    render(<Select value="" onChange={() => {}} options={OPTIONS} ariaLabel="Relație" invalid />);
    expect(screen.getByLabelText('Relație')).toHaveAttribute('aria-invalid', 'true');
  });

  it('e dezactivat cât `disabled` e adevărat', () => {
    render(<Select value="" onChange={() => {}} options={OPTIONS} ariaLabel="Relație" disabled />);
    expect(screen.getByLabelText('Relație')).toBeDisabled();
  });
});
