import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('randează varianta simplă cu rolul progressbar și valoarea corectă', () => {
    render(<ProgressBar value={62} tone="orange" label="Completare" />);
    const bar = screen.getByRole('progressbar', { name: 'Completare' });
    expect(bar).toHaveAttribute('aria-valuenow', '62');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('limitează valoarea simplă la intervalul 0-100', () => {
    render(<ProgressBar value={150} label="Peste" />);
    expect(screen.getByRole('progressbar', { name: 'Peste' })).toHaveAttribute('aria-valuenow', '100');
  });

  it('randează varianta segmentată cu bara ascunsă și un rezumat text', () => {
    render(
      <ProgressBar
        variant="segmented"
        segments={[
          { value: 45, tone: 'mint' },
          { value: 30, tone: 'orange' },
          { value: 15, tone: 'yellow' },
        ]}
      />,
    );
    expect(screen.getByText('Segmente: 45%, 30%, 15%.')).toBeInTheDocument();
  });

  it('randează varianta capacitate cu aria-valuetext „filled din total”', () => {
    render(<ProgressBar variant="capacity" filled={8} total={10} label="Locuri" />);
    const bar = screen.getByRole('progressbar', { name: 'Locuri' });
    expect(bar).toHaveAttribute('aria-valuenow', '8');
    expect(bar).toHaveAttribute('aria-valuemax', '10');
    expect(bar).toHaveAttribute('aria-valuetext', '8 din 10');
  });

  it('fără încălcări axe (R6) — simplu', async () => {
    const { container } = render(<ProgressBar value={62} label="Completare" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('fără încălcări axe (R6) — capacitate', async () => {
    const { container } = render(<ProgressBar variant="capacity" filled={8} total={10} label="Locuri" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
