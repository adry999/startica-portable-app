import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MonthStepper } from './MonthStepper';

describe('MonthStepper', () => {
  it('randează luna și anul din value', () => {
    render(<MonthStepper value="2026-03" onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByText('Martie 2026')).toBeInTheDocument();
  });

  it('cheamă onPrev/onNext la click pe săgeți', async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<MonthStepper value="2026-01" onPrev={onPrev} onNext={onNext} />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Luna anterioară'));
    expect(onPrev).toHaveBeenCalledTimes(1);

    await user.click(screen.getByLabelText('Luna următoare'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('tone="white" pune clasa albă pe rădăcină, implicit rămâne galbenă', () => {
    const { container, rerender } = render(<MonthStepper value="2026-06" onPrev={() => {}} onNext={() => {}} />);
    expect((container.firstChild as HTMLElement).className).not.toMatch(/white/);

    rerender(<MonthStepper value="2026-06" onPrev={() => {}} onNext={() => {}} tone="white" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/white/);
  });
});
