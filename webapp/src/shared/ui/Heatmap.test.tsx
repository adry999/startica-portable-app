import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Heatmap, type HeatmapCell } from './Heatmap';

const CELLS: HeatmapCell[] = [
  { key: '1', label: 'Ian — achitat', state: 'paid' },
  { key: '2', label: 'Feb — parțial', state: 'partial' },
  { key: '3', label: 'Mar — restanță', state: 'overdue' },
  { key: '4', label: 'Apr — curent', state: 'paid', current: true },
  { key: '5', label: 'Mai — viitor', state: 'future' },
  { key: '6', label: 'Iun — fără contract', state: 'no-contract' },
];

describe('Heatmap', () => {
  it('randează containerul ca role="img" cu ariaLabel-ul dat', () => {
    render(<Heatmap cells={CELLS} columns={6} ariaLabel="Situația plăților" />);
    expect(screen.getByRole('img', { name: 'Situația plăților' })).toBeInTheDocument();
  });

  it('randează o celulă pentru fiecare intrare din cells', () => {
    const { container } = render(<Heatmap cells={CELLS} columns={6} ariaLabel="Situația plăților" />);
    expect(container.querySelectorAll('[aria-describedby]')).toHaveLength(CELLS.length);
  });

  it('arată tooltip-ul cu eticheta celulei la hover', async () => {
    const user = userEvent.setup();
    const { container } = render(<Heatmap cells={CELLS} columns={6} ariaLabel="Situația plăților" />);
    const firstCell = container.querySelector('[aria-describedby]') as Element;
    await user.hover(firstCell);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Ian — achitat');
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<Heatmap cells={CELLS} columns={6} ariaLabel="Situația plăților" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
