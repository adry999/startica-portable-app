/** Ordinea grupelor (03-grupe.md §3b): `order` explicit dacă există, altfel poziția alfabetică
 * curentă — ca ordinea să rămână stabilă pentru grupele mai vechi, fără migrare separată. */
export interface OrderableGroup {
  id: string;
  name: string;
  order?: number;
}

export function groupOrderIndex(group: OrderableGroup, groups: OrderableGroup[]): number {
  if (group.order !== undefined && group.order !== null) return group.order;
  const alphabetical = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  const index = alphabetical.findIndex(candidate => candidate.id === group.id);
  return index === -1 ? 0 : index;
}

export function sortByGroupOrder<T extends OrderableGroup>(groups: T[]): T[] {
  return [...groups].sort((a, b) => {
    const diff = groupOrderIndex(a, groups) - groupOrderIndex(b, groups);
    return diff !== 0 ? diff : a.name.localeCompare(b.name, 'ro');
  });
}
