import { sortByGroupOrder, type OrderableGroup } from '@shared/format/group-order';

/**
 * Tonurile din 03-grupe.md §3/§5b.2 — distincte de `PillTone` (@shared/ui/group-tone),
 * care are doar 4 valori și e folosit în Copii/Achitări/Situația/Prezența. Grupe v2 are
 * nevoie de 7+ tonuri distincte (criteriu de acceptare), deci un sistem propriu, local
 * modulului, ca să nu rupă restul ecranelor care depind de PillTone cu 4 valori.
 */
export type BoardTone = 'yellow' | 'pink' | 'teal' | 'green' | 'blue' | 'orange' | 'purple' | 'coral';

/** Ordinea de fallback (7 tonuri, fără coral — coral se alege doar manual în Drawer). */
export const BOARD_TONE_FALLBACK: BoardTone[] = ['yellow', 'pink', 'teal', 'green', 'blue', 'orange', 'purple'];

/** Cele 8 tonuri disponibile ca pătrate de culoare în Drawer-ul „Grupă nouă” (§5b.3). */
export const BOARD_TONE_PALETTE: BoardTone[] = [...BOARD_TONE_FALLBACK, 'coral'];

export interface BoardToneColors {
  soft: string;
  ink: string;
  bar: string;
}

export const BOARD_TONE_COLORS: Record<BoardTone, BoardToneColors> = {
  yellow: { soft: 'var(--yellow-soft)', ink: 'var(--yellow-ink)', bar: 'var(--yellow-bar)' },
  pink: { soft: 'var(--pink-soft)', ink: 'var(--pink-ink)', bar: 'var(--pink-bar)' },
  teal: { soft: 'var(--teal-soft)', ink: 'var(--teal-ink)', bar: 'var(--teal-bar)' },
  green: { soft: 'var(--mint-soft)', ink: 'var(--mint-ink)', bar: 'var(--mint-bar)' },
  blue: { soft: 'var(--blue-soft)', ink: 'var(--blue-ink)', bar: 'var(--blue-bar)' },
  orange: { soft: 'var(--orange-soft)', ink: 'var(--orange-ink)', bar: 'var(--orange)' },
  purple: { soft: 'var(--purple-soft)', ink: 'var(--purple-ink)', bar: 'var(--purple-bar)' },
  coral: { soft: 'var(--coral-soft)', ink: 'var(--coral-ink)', bar: 'var(--coral-bar)' },
};

function isBoardTone(value: string | null | undefined): value is BoardTone {
  return !!value && (BOARD_TONE_PALETTE as string[]).includes(value);
}

export interface ToneableGroup extends OrderableGroup {
  tone?: string | null;
}

/** `group.tone` dacă e o cheie cunoscută, altfel calculat din poziția grupei (ordinea salvată
 * sau, în lipsa ei, cea alfabetică) — stabil și fără coliziuni previzibile pentru 7 grupe. */
export function boardTone(group: ToneableGroup, groups: ToneableGroup[]): BoardTone {
  if (isBoardTone(group.tone)) return group.tone;
  const ordered = sortByGroupOrder(groups);
  const index = ordered.findIndex(candidate => candidate.id === group.id);
  if (index === -1) return BOARD_TONE_FALLBACK[0];
  return BOARD_TONE_FALLBACK[index % BOARD_TONE_FALLBACK.length];
}

/** Primul ton neutilizat de nicio altă grupă — implicit pentru Drawer-ul „Grupă nouă” (§5b.3). */
export function firstUnusedTone(groups: ToneableGroup[]): BoardTone {
  const used = new Set(groups.map(group => boardTone(group, groups)));
  return BOARD_TONE_PALETTE.find(tone => !used.has(tone)) ?? BOARD_TONE_PALETTE[0];
}
