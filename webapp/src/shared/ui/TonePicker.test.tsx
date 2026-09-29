import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TonePicker } from './TonePicker';

const TONES = ['orange', 'mint', 'yellow', 'pink'];

describe('TonePicker', () => {
  it('arată numele românesc al tonului ca aria-label', () => {
    render(<TonePicker tones={TONES} value="orange" onChange={() => {}} ariaLabel="Culoare" />);
    expect(screen.getByRole('radio', { name: 'Portocaliu' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Mentă' })).toBeInTheDocument();
  });

  it('marchează tonul selectat prin aria-checked', () => {
    render(<TonePicker tones={TONES} value="mint" onChange={() => {}} ariaLabel="Culoare" />);
    expect(screen.getByRole('radio', { name: 'Mentă' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Portocaliu' })).toHaveAttribute('aria-checked', 'false');
  });

  it('apelează onChange cu tonul ales la click', async () => {
    const onChange = vi.fn();
    render(<TonePicker tones={TONES} value="orange" onChange={onChange} ariaLabel="Culoare" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: 'Galben' }));

    expect(onChange).toHaveBeenCalledWith('yellow');
  });
});
