import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DayStepper } from './DayStepper';

describe('DayStepper', () => {
  it('săgeata înainte e dezactivată când ziua e max, cea înapoi merge cu o zi în urmă', async () => {
    const onChange = vi.fn();
    render(<DayStepper value="2026-09-27" max="2026-09-27" onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'Ziua următoare' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Ziua anterioară' }));
    expect(onChange).toHaveBeenCalledWith('2026-09-26');
  });
});
