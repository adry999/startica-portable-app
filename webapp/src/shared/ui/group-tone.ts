import type { PillTone } from './FilterPills';
import { sortByGroupOrder, type OrderableGroup } from '@shared/format/group-order';

// Aceeași ordine ca BOARD_TONE_FALLBACK + coral din groupBoardTone.ts (Grupe v2, §3/§5b.2) —
// cele 8 tonuri sunt acum comune ambelor sisteme; „mint” aici == „green” acolo (același token).
const TONES: PillTone[] = ['yellow', 'pink', 'teal', 'mint', 'blue', 'orange', 'purple', 'coral'];

/** Grupele nu au culoare salvată explicit pentru pastile (Grupe v2 permite alegere manuală prin
 * `group.tone`, vezi `groupBoardTone.ts`; aici rămâne pur pozițional — de aliniat dacă se cere).
 * Culoarea vine din poziția grupei — `order` (03-grupe.md §3b) dacă există, altfel ordinea
 * alfabetică curentă — deci e stabilă și consistentă cu ordinea afișată în Grupe (aceeași grupă
 * are aceeași culoare peste tot: badge, pastile, calendar, tablă). */
export function groupTone(groupId: string | null, groups: OrderableGroup[]): PillTone {
  if (!groupId) return 'neutral';
  const sorted = sortByGroupOrder(groups);
  const index = sorted.findIndex(group => group.id === groupId);
  if (index === -1) return 'neutral';
  return TONES[index % TONES.length];
}
