import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AttendanceStatus } from '#features/attendance/attendance.types.d.mts';
import { MonthView } from './MonthView';
import type { AttendanceMonthData, MonthRowView } from './useAttendanceMonth';

function buildRow(overrides: Partial<MonthRowView> = {}): MonthRowView {
  return {
    id: 'c1',
    name: 'Ana Popescu',
    cells: [{ date: '2026-09-15', kind: 'absent', reason: '' }],
    presentDays: 0,
    workingDays: 1,
    ...overrides,
  };
}

function buildData(overrides: Partial<AttendanceMonthData> = {}): AttendanceMonthData {
  return {
    status: 'ready',
    failureMessage: '',
    saving: false,
    saveError: '',
    savedAt: '',
    unsavedCount: 0,
    retry: vi.fn(),
    dates: ['2026-09-15'],
    dayNumbers: [15],
    offDays: [false],
    todayIndex: -1,
    isHistoricalMonth: false,
    rows: [buildRow()],
    presentPerDay: [0],
    groups: [],
    hasUnassignedChildren: false,
    groupId: 'g1',
    setGroupId: vi.fn(),
    groupName: 'Fluturași',
    cycle: vi.fn(),
    setReason: vi.fn(),
    history: [],
    canUndo: false,
    undoLast: vi.fn(),
    undoUntil: vi.fn(),
    undoAll: vi.fn(),
    ...overrides,
  };
}

describe('MonthView · popover-ul „Motivat”', () => {
  it('primește motivul deja salvat pentru acea zi, nu unul gol', async () => {
    const data = buildData({
      rows: [buildRow({ cells: [{ date: '2026-09-15', kind: 'excused', reason: 'Boală' }] })],
      cycle: vi.fn((): AttendanceStatus => 'excused'),
    });

    render(<MonthView month="2026-09" data={data} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ana Popescu: 2026-09-15' }));

    const dialog = screen.getByRole('dialog', { name: /Ana Popescu/ });
    expect(within(dialog).getByPlaceholderText('Motivul absenței…')).toHaveValue('Boală');
  });
});

describe('MonthView · indiciul „Copiii din grupa de azi” (Audit-B #4)', () => {
  it('apare doar când luna vizualizată nu e luna curentă', () => {
    const { rerender } = render(<MonthView month="2026-09" data={buildData({ isHistoricalMonth: false })} />);
    expect(screen.queryByText('Copiii din grupa de azi')).not.toBeInTheDocument();

    rerender(<MonthView month="2020-01" data={buildData({ isHistoricalMonth: true })} />);
    expect(screen.getByText('Copiii din grupa de azi')).toBeInTheDocument();
  });
});
