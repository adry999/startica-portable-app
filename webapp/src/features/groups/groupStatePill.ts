import type { GroupCardView } from './useGroups';

/** Pastila de stare din 03-grupe.md §3 — `null` înseamnă nicio pastilă (ocupare normală). */
export function capacityPillLabel(group: GroupCardView): string | null {
  if (group.capacityState === 'over') return `Peste cu ${group.overCapacityBy}`;
  if (group.capacityState === 'full') return 'Plină';
  if (group.capacityState === 'empty') return 'Goală';
  return null;
}
