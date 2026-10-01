import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChipSelect } from './ChipSelect';

const OPTIONS = [
  { value: 'lu', label: 'Lu' },
  { value: 'ma', label: 'Ma' },
  { value: 'mi', label: 'Mi', disabled: true },
] as const;

describe('ChipSelect', () => {
  it('marchează opțiunea selectată prin aria-checked', () => {
    render(<ChipSelect options={OPTIONS} value="lu" onChange={() => {}} ariaLabel="Zile" />);
    expect(screen.getByRole('radio', { name: 'Lu' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Ma' })).toHaveAttribute('aria-checked', 'false');
  });

  it('apelează onChange cu valoarea aleasă la click', async () => {
    const onChange = vi.fn();
    render(<ChipSelect options={OPTIONS} value="lu" onChange={onChange} ariaLabel="Zile" />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: 'Ma' }));

    expect(onChange).toHaveBeenCalledWith('ma');
  });

  it('dezactivează opțiunile marcate `disabled`', () => {
    render(<ChipSelect options={OPTIONS} value="lu" onChange={() => {}} ariaLabel="Zile" />);
    expect(screen.getByRole('radio', { name: 'Mi' })).toBeDisabled();
  });

  it('aplică tonul unei opțiuni nealese, dar nu și al celei selectate (rămâne plin)', () => {
    const TONE_OPTIONS = [
      { value: 'a', label: 'Grupa A', tone: 'orange' as const },
      { value: 'b', label: 'Grupa B', tone: 'mint' as const },
    ];
    render(<ChipSelect options={TONE_OPTIONS} value="a" onChange={() => {}} ariaLabel="Grupe" />);
    expect(screen.getByRole('radio', { name: 'Grupa A' }).className).not.toMatch(/orange/);
    expect(screen.getByRole('radio', { name: 'Grupa B' }).className).toMatch(/mint/);
  });

  it('hint devine title (tooltip nativ)', () => {
    const HINT_OPTIONS = [{ value: 'a', label: 'Grupa A', hint: '3 din 10 locuri libere' }];
    render(<ChipSelect options={HINT_OPTIONS} value="a" onChange={() => {}} ariaLabel="Grupe" />);
    expect(screen.getByRole('radio', { name: 'Grupa A' })).toHaveAttribute('title', '3 din 10 locuri libere');
  });
});
