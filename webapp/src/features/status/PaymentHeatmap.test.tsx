import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PaymentHeatmap } from './PaymentHeatmap';
import type { HeatRowView } from './useSchoolYearStatus';

const monthLabels = ['Sep', 'Oct', 'Noi'];

const rows: HeatRowView[] = [
  {
    id: 'c1',
    name: 'Andrei Popescu',
    archived: false,
    groupId: null,
    cells: [
      { month: '2026-09', kind: 'unpaid' },
      { month: '2026-10', kind: 'paid' },
      { month: '2026-11', kind: 'upcoming' },
    ],
    sold: 0,
    soldCurrency: 'MDL',
  },
  {
    id: 'c2',
    name: 'Maria Ionescu',
    archived: false,
    groupId: null,
    cells: [
      { month: '2026-09', kind: 'partial' },
      { month: '2026-10', kind: 'paid' },
      { month: '2026-11', kind: 'none' },
    ],
    sold: 200,
    soldCurrency: 'EUR',
  },
];

describe('PaymentHeatmap', () => {
  it('randează legenda cu cele patru stări', () => {
    render(<PaymentHeatmap rows={rows} monthLabels={monthLabels} currentMonth="2026-10" />);
    expect(screen.getByText('Achitat')).toBeInTheDocument();
    expect(screen.getByText('Parțial')).toBeInTheDocument();
    expect(screen.getByText('Neachitat')).toBeInTheDocument();
    expect(screen.getByText('Urmează')).toBeInTheDocument();
  });

  it('marchează celulele cu luna și statutul lor, luna curentă cu contur', () => {
    render(<PaymentHeatmap rows={rows} monthLabels={monthLabels} currentMonth="2026-10" />);
    const currentCells = screen.getAllByRole('img', { name: /Oct: Achitat/ });
    expect(currentCells).toHaveLength(2);
    currentCells.forEach(cell => expect(cell).toHaveClass(/current/));
  });

  it('afișează soldul cu moneda rândului', () => {
    render(<PaymentHeatmap rows={rows} monthLabels={monthLabels} currentMonth="2026-10" />);
    const row = screen.getByText('Maria Ionescu').closest('div') as HTMLElement;
    expect(within(row).getByText('200,00 €')).toBeInTheDocument();
  });

  it('arată starea goală când nu sunt copii cu obligație', () => {
    render(<PaymentHeatmap rows={[]} monthLabels={monthLabels} currentMonth={null} />);
    expect(screen.getByText('Niciun copil cu obligație în anul ales.')).toBeInTheDocument();
  });
});
