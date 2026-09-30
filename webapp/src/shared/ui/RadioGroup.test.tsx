import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { RadioGroup } from './RadioGroup';

const OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'transfer', label: 'Transfer', disabled: true },
];

describe('RadioGroup', () => {
  it('arată opțiunea selectată prin starea bifată', () => {
    render(<RadioGroup name="metoda" ariaLabel="Metodă" options={OPTIONS} value="cash" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Cash' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Card' })).not.toBeChecked();
  });

  it('apelează onChange cu valoarea aleasă la clic', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<RadioGroup name="metoda" ariaLabel="Metodă" options={OPTIONS} value="cash" onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'Card' }));

    expect(onChange).toHaveBeenCalledWith('card');
  });

  it('nu răspunde la clic pe o opțiune dezactivată', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<RadioGroup name="metoda" ariaLabel="Metodă" options={OPTIONS} value="cash" onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'Transfer' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('dezactivează toate opțiunile cu prop-ul `disabled`', () => {
    render(<RadioGroup name="metoda" ariaLabel="Metodă" options={OPTIONS} value="cash" onChange={() => {}} disabled />);
    expect(screen.getByRole('radio', { name: 'Cash' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Card' })).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <RadioGroup name="metoda" ariaLabel="Metodă" options={OPTIONS} value="cash" onChange={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
