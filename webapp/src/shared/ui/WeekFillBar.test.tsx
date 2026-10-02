import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { WeekFillBar } from './WeekFillBar';

describe('WeekFillBar', () => {
  it('arată intervalul și cele două acțiuni', () => {
    render(<WeekFillBar weekLabel="7 – 11 sep" onFillPresent={() => {}} onCopyPreviousWeek={() => {}} />);
    expect(screen.getByText('7 – 11 sep')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toți prezenți L–V' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiază săpt. trecută' })).toBeInTheDocument();
  });

  it('clic pe „Toți prezenți L–V” cheamă onFillPresent', async () => {
    const onFillPresent = vi.fn();
    render(<WeekFillBar weekLabel="7 – 11 sep" onFillPresent={onFillPresent} onCopyPreviousWeek={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Toți prezenți L–V' }));
    expect(onFillPresent).toHaveBeenCalledOnce();
  });

  it('clic pe „Copiază săpt. trecută” cheamă onCopyPreviousWeek', async () => {
    const onCopyPreviousWeek = vi.fn();
    render(<WeekFillBar weekLabel="7 – 11 sep" onFillPresent={() => {}} onCopyPreviousWeek={onCopyPreviousWeek} />);
    await userEvent.click(screen.getByRole('button', { name: 'Copiază săpt. trecută' }));
    expect(onCopyPreviousWeek).toHaveBeenCalledOnce();
  });

  it('arată starea de încărcare pe acțiunea pornită și dezactivează cealaltă', () => {
    const { container } = render(
      <WeekFillBar weekLabel="7 – 11 sep" onFillPresent={() => {}} onCopyPreviousWeek={() => {}} fillingPresent />,
    );
    const [fillButton, copyButton] = container.querySelectorAll('button');
    expect(fillButton).toHaveAttribute('aria-busy', 'true');
    expect(copyButton).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <WeekFillBar weekLabel="7 – 11 sep" onFillPresent={() => {}} onCopyPreviousWeek={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
