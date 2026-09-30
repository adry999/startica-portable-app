import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { DayGrid, type DayGridRow } from './DayGrid';

const columnLabels = ['1', '2', '3'];

function makeRows(onClick?: () => void): DayGridRow[] {
  return [
    {
      key: 'r1',
      label: 'Ionescu Maria',
      cells: [
        { key: 'c1', tone: 'mint', ariaLabel: '1 septembrie, prezent', onClick },
        { key: 'c2', isWeekend: true, ariaLabel: '2 septembrie, weekend' },
        { key: 'c3', isToday: true, tone: 'raspberry', ariaLabel: '3 septembrie, absent' },
      ],
    },
  ];
}

describe('DayGrid', () => {
  it('randează eticheta de rând și etichetele coloanelor', () => {
    render(<DayGrid kind="dot" columnLabels={columnLabels} rows={makeRows()} />);
    expect(screen.getByText('Ionescu Maria')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('apelează onClick pe celula corespunzătoare', async () => {
    const onClick = vi.fn();
    render(<DayGrid kind="dot" columnLabels={columnLabels} rows={makeRows(onClick)} />);
    await userEvent.click(screen.getByRole('button', { name: '1 septembrie, prezent' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('celulele fără onClick sunt dezactivate', () => {
    render(<DayGrid kind="dot" columnLabels={columnLabels} rows={makeRows()} />);
    expect(screen.getByRole('button', { name: '2 septembrie, weekend' })).toBeDisabled();
  });

  it('afișează un spinner pe celula `saving`', () => {
    const rows: DayGridRow[] = [
      { key: 'r1', label: 'Ana', cells: [{ key: 'c1', saving: true, ariaLabel: 'Se salvează' }] },
    ];
    render(<DayGrid kind="code" columnLabels={['1']} rows={rows} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('afișează codul text pentru kind="code"', () => {
    const rows: DayGridRow[] = [
      { key: 'r1', label: 'Ana', cells: [{ key: 'c1', content: 'CO', ariaLabel: 'Concediu odihnă' }] },
    ];
    render(<DayGrid kind="code" columnLabels={['1']} rows={rows} />);
    expect(screen.getByText('CO')).toBeInTheDocument();
  });

  it('randează rândul de subsol când e dat', () => {
    render(<DayGrid kind="dot" columnLabels={columnLabels} rows={makeRows()} footer={['30', '29', '28']} />);
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('marchează rândul `loading` ca fără interacțiune', () => {
    const rows: DayGridRow[] = [
      { key: 'r1', label: 'Ana', cells: [{ key: 'c1', onClick: vi.fn(), ariaLabel: 'Zi' }], loading: true },
    ];
    render(<DayGrid kind="dot" columnLabels={['1']} rows={rows} />);
    expect(screen.getByRole('button', { name: 'Zi' })).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<DayGrid kind="dot" columnLabels={columnLabels} rows={makeRows(() => {})} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
