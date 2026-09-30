import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { DiffTable } from './DiffTable';

const COLUMNS = [
  { key: 'local' as const, label: 'Pe acest calculator' },
  { key: 'remote' as const, label: 'Pe LAPTOP-ANA' },
];

const ROWS = [
  { key: 'name', label: 'Nume', local: 'Ionescu Maria', remote: 'Ionescu Maria', differs: false },
  { key: 'phone', label: 'Telefon', local: '069123456', remote: '069999999', differs: true },
];

describe('DiffTable', () => {
  it('randează coloanele și rândurile primite', () => {
    render(<DiffTable columns={COLUMNS} rows={ROWS} />);
    expect(screen.getByText('Pe acest calculator')).toBeInTheDocument();
    expect(screen.getByText('Pe LAPTOP-ANA')).toBeInTheDocument();
    expect(screen.getByText('Nume')).toBeInTheDocument();
    expect(screen.getByText('069123456')).toBeInTheDocument();
    expect(screen.getByText('069999999')).toBeInTheDocument();
  });

  it('marchează doar rândurile care diferă', () => {
    render(<DiffTable columns={COLUMNS} rows={ROWS} />);
    expect(screen.getByText('Telefon').closest('div')?.className).toMatch(/rowDiffers/);
    expect(screen.getByText('Nume').closest('div')?.className).not.toMatch(/rowDiffers/);
  });

  it('randează nota opțională doar când e primită', () => {
    const { rerender } = render(<DiffTable columns={COLUMNS} rows={ROWS} />);
    expect(screen.queryByText('Rândurile galbene diferă.')).not.toBeInTheDocument();
    rerender(<DiffTable columns={COLUMNS} rows={ROWS} note="Rândurile galbene diferă." />);
    expect(screen.getByText('Rândurile galbene diferă.')).toBeInTheDocument();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<DiffTable columns={COLUMNS} rows={ROWS} note="Notă" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
