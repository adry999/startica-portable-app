import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { NumberStepper } from './NumberStepper';

describe('NumberStepper', () => {
  it('randează valoarea curentă', () => {
    render(<NumberStepper ariaLabel="Locuri" value={4} onChange={() => {}} />);
    expect(screen.getByRole('spinbutton', { name: 'Locuri' })).toHaveTextContent('4');
  });

  it('cheamă onChange cu valoarea crescută/scăzută la clic pe +/−', async () => {
    const onChange = vi.fn();
    render(<NumberStepper ariaLabel="Locuri" value={4} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Crește Locuri' }));
    expect(onChange).toHaveBeenCalledWith(5);
    await userEvent.click(screen.getByRole('button', { name: 'Scade Locuri' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('respectă step', async () => {
    const onChange = vi.fn();
    render(<NumberStepper ariaLabel="Locuri" value={10} step={5} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Crește Locuri' }));
    expect(onChange).toHaveBeenCalledWith(15);
  });

  it('dezactivează minus la min și plus la max', () => {
    render(<NumberStepper ariaLabel="Locuri" value={0} min={0} max={10} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Scade Locuri' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Crește Locuri' })).not.toBeDisabled();
  });

  it('nu depășește min/max la clic', async () => {
    const onChange = vi.fn();
    render(<NumberStepper ariaLabel="Locuri" value={10} min={0} max={10} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Crește Locuri' })).toBeDisabled();
  });

  it('dezactivează ambele butoane când disabled', () => {
    render(<NumberStepper ariaLabel="Locuri" value={4} disabled onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Scade Locuri' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Crește Locuri' })).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<NumberStepper ariaLabel="Locuri" value={4} min={0} max={10} onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
