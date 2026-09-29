import { describe, expect, it } from 'vitest';
import {
  dayOfYear,
  daysInYear,
  formatLeaveRange,
  leaveDaysRemaining,
  leaveWorkingDays,
  leaveYearBar,
  overlappingLeavesInGroup,
} from './leave-days';
import type { Leave } from './personal.types';

describe('leaveWorkingDays', () => {
  it('un concediu CO de 6–27 iulie 2026 consumă 16 zile lucrătoare', () => {
    // 6–27 iulie 2026: 22 zile calendaristice, 4 weekend-uri complete + fără sărbători legale.
    expect(leaveWorkingDays({ from: '2026-07-06', to: '2026-07-27' })).toBe(16);
  });
});

describe('leaveDaysRemaining', () => {
  it('un concediu CO de 6–27 iulie și un rest de 28 lasă 12 zile rămase', () => {
    const leaves: Leave[] = [
      { id: 'LV-1', staffId: 'STF-1', from: '2026-07-06', to: '2026-07-27', type: 'CO', planned: false },
    ];
    expect(leaveDaysRemaining({ leaves, annualLeaveDays: 28 })).toEqual({ used: 16, planned: 0, remaining: 12 });
  });

  it('concediile planificate scad din rămas la fel ca cele consumate', () => {
    const leaves: Leave[] = [
      { id: 'LV-1', staffId: 'STF-1', from: '2026-07-06', to: '2026-07-27', type: 'CO', planned: true },
    ];
    expect(leaveDaysRemaining({ leaves, annualLeaveDays: 28 })).toEqual({ used: 0, planned: 16, remaining: 12 });
  });

  it('boala (CM) nu scade din concediul de odihnă', () => {
    const leaves: Leave[] = [
      { id: 'LV-1', staffId: 'STF-1', from: '2026-07-06', to: '2026-07-10', type: 'CM', planned: false },
    ];
    expect(leaveDaysRemaining({ leaves, annualLeaveDays: 28 }).remaining).toBe(28);
  });
});

describe('dayOfYear/daysInYear', () => {
  it('1 ianuarie e ziua 1', () => {
    expect(dayOfYear('2026-01-01')).toBe(1);
  });

  it('1 martie e ziua 60 într-un an nebisect', () => {
    expect(dayOfYear('2026-03-01')).toBe(60);
  });

  it('1 martie e ziua 61 într-un an bisect', () => {
    expect(dayOfYear('2024-03-01')).toBe(61);
  });

  it('2026 are 365 de zile, 2024 are 366', () => {
    expect(daysInYear('2026')).toBe(365);
    expect(daysInYear('2024')).toBe(366);
  });
});

describe('leaveYearBar', () => {
  it('poziționează un concediu de 6-27 iulie 2026 proporțional cu ziua din an', () => {
    const bar = leaveYearBar({ from: '2026-07-06', to: '2026-07-27' }, '2026');
    expect(bar.leftPct).toBeCloseTo(((dayOfYear('2026-07-06') - 1) / 365) * 100, 5);
    expect(bar.widthPct).toBeCloseTo((22 / 365) * 100, 5);
  });

  it('taie la marginea anului un concediu care începe în decembrie anul trecut', () => {
    const bar = leaveYearBar({ from: '2025-12-28', to: '2026-01-05' }, '2026');
    expect(bar.leftPct).toBe(0);
    expect(bar.widthPct).toBeCloseTo((5 / 365) * 100, 5);
  });
});

describe('formatLeaveRange', () => {
  it('aceeași lună: „15–27 iulie”', () => {
    expect(formatLeaveRange('2026-07-15', '2026-07-27')).toBe('15–27 iulie');
  });

  it('luni diferite: „28 iulie – 3 august”', () => {
    expect(formatLeaveRange('2026-07-28', '2026-08-03')).toBe('28 iulie – 3 august');
  });
});

describe('overlappingLeavesInGroup', () => {
  const groups = [
    {
      id: 'GRP-1',
      team: [
        { staffId: 'STF-1', role: 'principal' as const },
        { staffId: 'STF-2', role: 'asistent' as const },
      ],
    },
  ];

  it('două concedii suprapuse în aceeași grupă sunt raportate o singură dată', () => {
    const leaves: Leave[] = [
      { id: 'LV-1', staffId: 'STF-1', from: '2026-07-06', to: '2026-07-27', type: 'CO', planned: false },
      { id: 'LV-2', staffId: 'STF-2', from: '2026-07-20', to: '2026-08-01', type: 'CO', planned: false },
    ];
    const warnings = overlappingLeavesInGroup(leaves, groups);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ groupId: 'GRP-1', from: '2026-07-20', to: '2026-07-27' });
  });

  it('concediile din grupe diferite nu produc avertizare', () => {
    const leaves: Leave[] = [
      { id: 'LV-1', staffId: 'STF-1', from: '2026-07-06', to: '2026-07-27', type: 'CO', planned: false },
      { id: 'LV-2', staffId: 'STF-3', from: '2026-07-20', to: '2026-08-01', type: 'CO', planned: false },
    ];
    expect(overlappingLeavesInGroup(leaves, groups)).toHaveLength(0);
  });
});
