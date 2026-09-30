import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Slider } from './Slider';

describe('Slider', () => {
  it('randează valoarea curentă', () => {
    render(<Slider ariaLabel="Mărime" value={50} onChange={() => {}} />);
    expect(screen.getByRole('slider', { name: 'Mărime' })).toHaveValue('50');
  });

  it('folosește min/max/step impliciți', () => {
    render(<Slider ariaLabel="Mărime" value={50} onChange={() => {}} />);
    const input = screen.getByRole('slider', { name: 'Mărime' });
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '100');
    expect(input).toHaveAttribute('step', '1');
  });

  it('cheamă onChange cu noua valoare', () => {
    const onChange = vi.fn();
    render(<Slider ariaLabel="Mărime" value={50} onChange={onChange} />);
    const input = screen.getByRole('slider', { name: 'Mărime' });
    fireEvent.change(input, { target: { value: '70' } });
    expect(onChange).toHaveBeenCalledWith(70);
  });

  it('respectă min/max/step personalizate', () => {
    render(<Slider ariaLabel="Mărime" value={5} min={1} max={10} step={1} onChange={() => {}} />);
    const input = screen.getByRole('slider', { name: 'Mărime' });
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '10');
  });

  it('poate fi dezactivat', () => {
    render(<Slider ariaLabel="Mărime" value={50} disabled onChange={() => {}} />);
    expect(screen.getByRole('slider', { name: 'Mărime' })).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<Slider ariaLabel="Mărime" value={50} onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
