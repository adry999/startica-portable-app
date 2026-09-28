import type { PillTone } from './FilterPills';
import { sortByGroupOrder, type OrderableGroup } from '@shared/format/group-order';

const TONES: PillTone[] = ['orange', 'mint', 'yellow', 'pink'];

/** Grupele nu au culoare salvată. Culoarea vine din poziția grupei — `order` (03-grupe.md §3b)
 * dacă există, altfel ordinea alfabetică curentă — deci e stabilă și consistentă cu ordinea
 * afișată în Grupe (aceeași grupă are aceeași culoare peste tot: badge, pastile, calendar). */
export function groupTone(groupId: string | null, groups: OrderableGroup[]): PillTone {
  if (!groupId) return 'neutral';
  const sorted = sortByGroupOrder(groups);
  const index = sorted.findIndex(group => group.id === groupId);
  if (index === -1) return 'neutral';
  return TONES[index % TONES.length];
}
