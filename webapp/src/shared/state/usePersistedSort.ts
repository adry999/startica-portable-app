import { usePersistedState } from './usePersistedState';
import type { DataTableSort } from '@shared/ui';

/**
 * Sortarea unui `DataTable` controlat, persistată în localStorage (§13.1 PROMPT-8 — listele cu
 * dată pornesc descrescător, dar alegerea utilizatorului (altă coloană, altă direcție) se ține
 * minte pe pagină, nu doar pentru montarea curentă). `usePersistedState` acceptă doar string, deci
 * sortarea se ține codificată `"cheie:direcție"`.
 */
export function usePersistedSort(
  key: string,
  defaultSort: DataTableSort,
): [DataTableSort, (sort: DataTableSort | null) => void] {
  const defaultRaw = `${defaultSort.key}:${defaultSort.direction}`;
  const [raw, setRaw] = usePersistedState<string>(key, defaultRaw);
  const [sortKey, direction] = raw.split(':');
  const sort: DataTableSort =
    sortKey && (direction === 'asc' || direction === 'desc') ? { key: sortKey, direction } : defaultSort;

  function setSort(next: DataTableSort | null) {
    setRaw(next ? `${next.key}:${next.direction}` : defaultRaw);
  }

  return [sort, setSort];
}
