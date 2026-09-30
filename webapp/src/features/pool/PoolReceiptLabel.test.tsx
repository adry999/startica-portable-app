import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThermalBlock } from '@shared/ui';
import { PoolReceiptLabel, type PoolReceiptLabelProps } from './PoolReceiptLabel';

// Fixture după mockup-ul 24c din Bon 58mm.dc.html — Bazin (spec 23) nu are încă o sursă de date reală.
const fixture: PoolReceiptLabelProps = {
  childName: 'Avram Maria',
  groupName: 'Mars',
  coachName: 'Rusu Vlad',
  monthTitle: 'BAZIN · OCTOMBRIE',
  weekdayTime: 'Marți · 10:30',
  sessions: [
    { day: '6', monthLabel: 'oct' },
    { day: '13', monthLabel: 'oct' },
    { day: '20', monthLabel: 'oct', dashed: true },
    { day: '27', monthLabel: 'oct' },
  ],
  pricePerSession: 150,
  itemsNote: 'Costum de baie, cască, prosop, papuci.',
};

describe('PoolReceiptLabel', () => {
  it('arată numele copilului, grupa, antrenorul și programul fix', () => {
    render(
      <ThermalBlock>
        <PoolReceiptLabel {...fixture} />
      </ThermalBlock>,
    );

    expect(screen.getByText('Avram Maria')).toBeInTheDocument();
    expect(screen.getByText('Grupa Mars · antrenor Rusu Vlad')).toBeInTheDocument();
    expect(screen.getByText('Marți · 10:30')).toBeInTheDocument();
  });

  it('arată câte o celulă pentru fiecare ședință, cu ziua liberă punctată', () => {
    const { container } = render(
      <ThermalBlock>
        <PoolReceiptLabel {...fixture} />
      </ThermalBlock>,
    );

    expect(screen.getAllByText('oct')).toHaveLength(4);
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(container.querySelectorAll('[class*="dashed"]')).toHaveLength(1);
  });

  it('arată calculul lunar din numărul de ședințe taxabile și preț — ziua punctată nu se taxează (A-2)', () => {
    render(
      <ThermalBlock>
        <PoolReceiptLabel {...fixture} />
      </ThermalBlock>,
    );
    // 4 ședințe listate, 1 punctată (ziua 20) → 3 taxabile × 150 lei = 450 lei, mereu adevărat.
    expect(screen.getByText(/3 ședințe × 150 lei = 450 lei/)).toBeInTheDocument();
  });
});
