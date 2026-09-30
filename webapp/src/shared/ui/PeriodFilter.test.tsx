import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PeriodFilter } from './PeriodFilter';

describe('PeriodFilter', () => {
  it('apelează onFromChange/onToChange la schimbarea lunilor', () => {
    const onFromChange = vi.fn();
    const onToChange = vi.fn();
    render(<PeriodFilter from="" to="" onFromChange={onFromChange} onToChange={onToChange} />);

    fireEvent.change(screen.getByLabelText('Perioadă de la'), { target: { value: '2026-01' } });
    fireEvent.change(screen.getByLabelText('Perioadă până la'), { target: { value: '2026-03' } });

    expect(onFromChange).toHaveBeenCalledWith('2026-01');
    expect(onToChange).toHaveBeenCalledWith('2026-03');
  });

  it('afișează eticheta primită', () => {
    render(<PeriodFilter label="Interval" from="" to="" onFromChange={() => {}} onToChange={() => {}} />);
    expect(screen.getByText('Interval')).toBeInTheDocument();
  });

  it('leagă valorile primite de cele două câmpuri', () => {
    render(<PeriodFilter from="2026-01" to="2026-02" onFromChange={() => {}} onToChange={() => {}} />);
    expect(screen.getByLabelText('Perioadă de la')).toHaveValue('2026-01');
    expect(screen.getByLabelText('Perioadă până la')).toHaveValue('2026-02');
  });
});
