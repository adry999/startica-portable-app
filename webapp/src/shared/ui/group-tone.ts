import type { PillTone } from './FilterPills';
import { sortByGroupOrder, type OrderableGroup } from '@shared/format/group-order';

// Aceeași ordine ca BOARD_TONE_FALLBACK + coral din groupBoardTone.ts (Grupe v2, §3/§5b.2) —
// cele 8 tonuri sunt acum comune ambelor sisteme; „mint” aici == „green” acolo (același token).
const TONES: PillTone[] = ['yellow', 'pink', 'teal', 'mint', 'blue', 'orange', 'purple', 'coral'];

function isPillTone(value: string | null | undefined): value is PillTone {
  return !!value && (TONES as string[]).includes(value);
}

export interface ToneableGroup extends OrderableGroup {
  tone?: string | null;
}

/** `group.tone` dacă e o cheie cunoscută (aleasă manual în Drawer, vezi `groupBoardTone.ts`),
 * altfel calculat din poziția grupei — `order` (03-grupe.md §3b) dacă există, altfel ordinea
 * alfabetică curentă — deci e stabilă și consistentă cu ordinea afișată în Grupe (aceeași grupă
 * are aceeași culoare peste tot: badge, pastile, calendar, tablă, Tablă din Grupe v2). */
export function groupTone(groupId: string | null, groups: ToneableGroup[]): PillTone {
  if (!groupId) return 'neutral';
  const group = groups.find(candidate => candidate.id === groupId);
  if (!group) return 'neutral';
  if (isPillTone(group.tone)) return group.tone;
  const sorted = sortByGroupOrder(groups);
  const index = sorted.findIndex(candidate => candidate.id === groupId);
  if (index === -1) return 'neutral';
  return TONES[index % TONES.length];
}
