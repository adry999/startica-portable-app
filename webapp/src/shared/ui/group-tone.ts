import type { PillTone } from './FilterPills';

const TONES: PillTone[] = ['orange', 'mint', 'yellow', 'pink'];

/** Grupele nu au culoare salvată. Culoarea vine din poziția grupei în lista sortată după nume,
 * deci e stabilă — aceeași grupă are aceeași culoare peste tot (badge, pastile, calendar). */
export function groupTone(groupId: string | null, groups: { id: string; name: string }[]): PillTone {
  if (!groupId) return 'neutral';
  const sorted = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const index = sorted.findIndex(group => group.id === groupId);
  if (index === -1) return 'neutral';
  return TONES[index % TONES.length];
}
