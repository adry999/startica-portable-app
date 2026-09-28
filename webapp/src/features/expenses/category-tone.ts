import type { PillTone } from '@shared/ui/FilterPills';

// Aceleași 8 tonuri ca group-tone.ts — categoriile de cheltuieli nu au culoare salvată
// (ExpenseCategory are doar id/name), deci tonul vine din poziția alfabetică a numelui.
const TONES: PillTone[] = ['yellow', 'pink', 'teal', 'mint', 'blue', 'orange', 'purple', 'coral'];

export function categoryTone(name: string, categoryNames: string[]): PillTone {
  if (!name) return 'neutral';
  const sorted = [...new Set(categoryNames)].sort((a, b) => a.localeCompare(b, 'ro'));
  const index = sorted.indexOf(name);
  if (index === -1) return 'neutral';
  return TONES[index % TONES.length];
}
