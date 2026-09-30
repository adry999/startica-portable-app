import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { WeekGrid, type WeekGridEvent } from './WeekGrid';

const dayLabels = ['Lun', 'Mar'];
const hourLabels = ['09:00', '10:00'];

describe('WeekGrid', () => {
  it('randează etichetele zilelor și orelor', () => {
    render(<WeekGrid dayLabels={dayLabels} hourLabels={hourLabels} events={[]} />);
    expect(screen.getByText('Lun')).toBeInTheDocument();
    expect(screen.getByText('09:00')).toBeInTheDocument();
  });

  it('randează un eveniment cu eticheta lui, fără celulă goală suprapusă', () => {
    const events: WeekGridEvent[] = [{ key: 'e1', dayIndex: 0, startRow: 0, rowSpan: 1, label: 'Grupa Delfin' }];
    render(<WeekGrid dayLabels={dayLabels} hourLabels={hourLabels} events={events} />);
    expect(screen.getByText('Grupa Delfin')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lun 09:00 — liber' })).not.toBeInTheDocument();
  });

  it('apelează onEmptyCellClick cu ziua și ora corecte', async () => {
    const onEmptyCellClick = vi.fn();
    render(<WeekGrid dayLabels={dayLabels} hourLabels={hourLabels} events={[]} onEmptyCellClick={onEmptyCellClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Mar 10:00 — liber' }));
    expect(onEmptyCellClick).toHaveBeenCalledWith(1, 1);
  });

  it('dezactivează celulele goale și evenimentele când `loading`', () => {
    const events: WeekGridEvent[] = [{ key: 'e1', dayIndex: 0, startRow: 0, rowSpan: 1, label: 'Grupa Delfin' }];
    render(
      <WeekGrid dayLabels={dayLabels} hourLabels={hourLabels} events={events} onEmptyCellClick={vi.fn()} loading />,
    );
    expect(screen.getByRole('button', { name: 'Grupa Delfin' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lun 10:00 — liber' })).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const events: WeekGridEvent[] = [{ key: 'e1', dayIndex: 0, startRow: 0, rowSpan: 1, label: 'Grupa Delfin' }];
    const { container } = render(
      <WeekGrid dayLabels={dayLabels} hourLabels={hourLabels} events={events} onEmptyCellClick={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
