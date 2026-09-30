import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { SegmentCounter } from './SegmentCounter';

describe('SegmentCounter', () => {
  it('arată caractere/limită și numărul de segmente pentru text GSM-7 dintr-un singur SMS', () => {
    render(<SegmentCounter text="Buna ziua!" />);
    expect(screen.getByText('10/160 · 1 SMS')).toBeInTheDocument();
  });

  it('trece la plural și recalculează limita pentru un mesaj cu mai multe segmente GSM-7', () => {
    const text = 'a'.repeat(200);
    render(<SegmentCounter text={text} />);
    expect(screen.getByText('200/306 · 2 SMS-uri')).toBeInTheDocument();
  });

  it('comută pe pragurile UCS-2 când textul conține diacritice românești (ă/â/î/ș/ț)', () => {
    render(<SegmentCounter text="Bună ziua!" />);
    expect(screen.getByText('10/70 · 1 SMS')).toBeInTheDocument();
  });

  it('arată 0/160 · 0 SMS-uri pentru text gol', () => {
    render(<SegmentCounter text="" />);
    expect(screen.getByText('0/160 · 0 SMS-uri')).toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<SegmentCounter text="Bună ziua!" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
