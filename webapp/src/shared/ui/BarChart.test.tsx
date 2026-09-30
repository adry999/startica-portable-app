import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { BarChart } from './BarChart';

const SERIES = [
  { label: 'Iul', value: 41000 },
  { label: 'Aug', value: 35000 },
  { label: 'Sep', value: 45000, current: true },
];

const SECONDARY = [
  { label: 'Iul', value: 28000 },
  { label: 'Aug', value: 30000 },
  { label: 'Sep', value: 32000, current: true },
];

describe('BarChart', () => {
  it('randează containerul ca role="img" cu ariaLabel-ul dat', () => {
    render(<BarChart series={SERIES} ariaLabel="Încasări pe ultimele 3 luni" />);
    expect(screen.getByRole('img', { name: 'Încasări pe ultimele 3 luni' })).toBeInTheDocument();
  });

  it('randează etichetele lunilor pentru fiecare bară', () => {
    render(<BarChart series={SERIES} ariaLabel="Încasări" />);
    expect(screen.getByText('Iul')).toBeInTheDocument();
    expect(screen.getByText('Aug')).toBeInTheDocument();
    expect(screen.getByText('Sep')).toBeInTheDocument();
  });

  it('randează a doua serie alături de prima, aliniată pe lună', () => {
    render(<BarChart series={SERIES} secondarySeries={SECONDARY} ariaLabel="Încasări vs. cheltuieli" />);
    const months = screen.getAllByText(/^(Iul|Aug|Sep)$/);
    expect(months).toHaveLength(3);
  });

  it('arată tooltip-ul cu eticheta și valoarea la hover pe o bară', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BarChart series={[{ label: 'Sep', value: 45000, current: true }]} ariaLabel="Încasări" />,
    );
    const bar = container.querySelector('[aria-describedby]');
    expect(bar).not.toBeNull();
    await user.hover(bar as Element);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Sep: 45000');
  });

  it('randează schelet + spinner în starea loading, fără bare reale', () => {
    render(<BarChart series={[]} ariaLabel="Se încarcă" state="loading" />);
    expect(screen.getByRole('img', { name: 'Se încarcă' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Sep')).not.toBeInTheDocument();
  });

  it('randează „Fără date” în starea empty', () => {
    render(<BarChart series={[]} ariaLabel="Fără date" state="empty" />);
    expect(screen.getByText('Fără date')).toBeInTheDocument();
  });

  it('randează „Fără date” când series e goală, chiar fără state explicit', () => {
    render(<BarChart series={[]} ariaLabel="Fără date" />);
    expect(screen.getByText('Fără date')).toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <BarChart series={SERIES} secondarySeries={SECONDARY} ariaLabel="Încasări vs. cheltuieli" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
