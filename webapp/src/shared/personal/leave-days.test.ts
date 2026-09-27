import { describe, expect, it } from 'vitest';
import { leaveDaysRemaining, leaveWorkingDays, overlappingLeavesInGroup } from './leave-days';
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

describe('overlappingLeavesInGroup', () => {
  const groups = [{ id: 'GRP-1', team: [{ staffId: 'STF-1', role: 'principal' as const }, { staffId: 'STF-2', role: 'asistent' as const }] }];

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
