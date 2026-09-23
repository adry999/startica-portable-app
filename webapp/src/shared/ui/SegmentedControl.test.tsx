import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl', () => {
  const options = [
    { value: 'table', label: 'Tabel' },
    { value: 'monthly', label: 'Pe luni' },
  ] as const;

  it('marchează opțiunea curentă ca selectată', () => {
    render(<SegmentedControl options={options} value="table" onChange={() => {}} ariaLabel="Vizualizare" />);
    expect(screen.getByRole('radio', { name: 'Tabel' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Pe luni' })).toHaveAttribute('aria-checked', 'false');
  });

  it('anunță schimbarea la click pe altă opțiune', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={options} value="table" onChange={onChange} ariaLabel="Vizualizare" />);
    await userEvent.click(screen.getByRole('radio', { name: 'Pe luni' }));
    expect(onChange).toHaveBeenCalledWith('monthly');
  });
});
