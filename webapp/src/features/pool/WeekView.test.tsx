import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WeekView } from './WeekView';
import type { Child } from '@contracts/record-types.mjs';
import type { WeekDay } from '@shared/pool/usePool';

const booking = {
  id: 'PB-1',
  childId: 'C-1',
  coachId: 'STF-1',
  weekday: 2,
  time: '09:00',
  startDate: '2026-09-01',
  endDate: null,
  archivedAt: null,
  updatedAt: '',
};
const child = { id: 'C-1', name: 'Maria', dueDay: 10, status: 'Activ' as const } as Child;

function daysWith(state: 'unmarked' | 'present' | 'scheduled'): WeekDay[] {
  return [{ date: '2026-09-08', slots: [{ time: '09:00', entries: [{ booking, child, state }] }] }];
}

describe('WeekView', () => {
  it('clic pe placă ciclează prezent → lipsă → motivat → nemarcat; zilele viitoare nu se marchează', async () => {
    const onCycle = vi.fn();
    render(
      <WeekView
        days={daysWith('unmarked')}
        stats={{ scheduled: 0, present: 0, absent: 0, excused: 0 }}
        onCycle={onCycle}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Maria/ }));
    expect(onCycle).toHaveBeenCalledWith('PB-1', '2026-09-08', 'present');
  });

  it('o zi viitoare (programată) nu are placa acționabilă', () => {
    render(
      <WeekView
        days={daysWith('scheduled')}
        stats={{ scheduled: 0, present: 0, absent: 0, excused: 0 }}
        onCycle={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Maria/ })).toBeDisabled();
  });
});
