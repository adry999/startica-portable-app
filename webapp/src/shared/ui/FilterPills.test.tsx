import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterPills } from './FilterPills';

describe('FilterPills', () => {
  it('randează etichetele grupurilor și opțiunile, cu cea curentă bifată', () => {
    render(
      <FilterPills
        groups={[
          {
            label: 'Metodă',
            value: 'numerar',
            onChange: () => {},
            options: [
              { value: 'numerar', label: 'Numerar', tone: 'mint' },
              { value: 'card', label: 'Card', tone: 'blue' },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText('Metodă')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Numerar' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Card' })).toHaveAttribute('aria-checked', 'false');
  });

  it('un click pe o opțiune cheamă onChange cu valoarea ei', async () => {
    const onChange = vi.fn();
    render(
      <FilterPills
        groups={[
          {
            label: 'Grupa',
            value: 'a',
            onChange,
            options: [
              { value: 'a', label: 'Grupa A', tone: 'yellow' },
              { value: 'b', label: 'Grupa B', tone: 'pink' },
            ],
          },
        ]}
      />,
    );

    await userEvent.setup().click(screen.getByRole('radio', { name: 'Grupa B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('mai multe grupuri randează un separator între ele, iar trailing apare la capăt', () => {
    render(
      <FilterPills
        groups={[
          { label: 'Metodă', value: 'x', onChange: () => {}, options: [{ value: 'x', label: 'X', tone: 'mint' }] },
          { label: 'Serviciu', value: 'y', onChange: () => {}, options: [{ value: 'y', label: 'Y', tone: 'teal' }] },
        ]}
        trailing="12 zile de naștere"
      />,
    );

    expect(screen.getByText('Serviciu')).toBeInTheDocument();
    expect(screen.getByText('12 zile de naștere')).toBeInTheDocument();
  });
});
