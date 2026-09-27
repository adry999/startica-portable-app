import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SmsSegmentCounter } from './SmsSegmentCounter';

describe('SmsSegmentCounter', () => {
  it('arată caractere, segmente și cost estimat pentru text GSM-7', () => {
    render(<SmsSegmentCounter text="Salut, lume!" unitCost={0.3} />);

    expect(screen.getByText('12 caractere · 1 SMS · ≈ 0,30 lei', { exact: false })).toBeInTheDocument();
  });

  it('primește class ucs2 pentru text cu diacritice', () => {
    render(<SmsSegmentCounter text="ă" unitCost={0.3} />);

    expect(screen.getByTestId('sms-segment-counter').className).toContain('ucs2');
  });
});
