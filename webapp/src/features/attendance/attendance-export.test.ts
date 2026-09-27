import { describe, expect, it } from 'vitest';
import { buildAttendanceSheet } from './attendance-export';

describe('buildAttendanceSheet', () => {
  it('foaia are antetul, un rând per copil cu P/A/M și totalul', () => {
    const dates = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-05'];
    const rows = [
      {
        name: 'Ana Popescu',
        cells: [
          { date: '2026-09-01', kind: 'present' as const },
          { date: '2026-09-02', kind: 'absent' as const },
          { date: '2026-09-03', kind: 'excused' as const },
          { date: '2026-09-05', kind: 'off' as const },
        ],
        presentDays: 1,
        workingDays: 3,
      },
    ];

    const sheet = buildAttendanceSheet(rows, dates);
    expect(sheet[0]).toEqual(['Copil', 1, 2, 3, 5, 'Zile']);
    expect(sheet[1]).toEqual(['Ana Popescu', 'P', 'A', 'M', '', '1/3']);
  });
});
