import { TYPES, emptyState } from './record-schema.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */

// Reproduce exact regula migrării 002 (schema SQLite): un copil cu câmp text
// `group` primește o entitate `groups` proprie (dedup după numele normalizat) și
// `groupId`; câmp gol → groupId null. Un instantaneu vechi de backup sau un export
// Excel STARTICA_EXPORT_2 dinainte de entitatea „grupe” ajunge aici cu exact acest
// format, iar validateState() ar respinge sau ar pierde datele fără această trecere.
/**
 * @param {any} input
 * @returns {{ snapshot: RecordsSnapshot, notes: string[] }}
 */
export function upgradeSnapshot(input) {
  const source = input && typeof input === 'object' ? input : {};
  const notes = [];

  for (const kind of Object.keys(source))
    if (!TYPES.includes(kind)) {
      const count = Array.isArray(source[kind]) ? source[kind].length : 0;
      notes.push(`Tip necunoscut ignorat: ${kind} (${count} înregistrări).`);
    }

  const snapshot = emptyState();
  for (const type of TYPES) if (Array.isArray(source[type])) snapshot[type] = structuredClone(source[type]);

  const nameToId = new Map(
    snapshot.groups.filter(group => group?.name).map(group => [String(group.name).trim(), group.id]),
  );
  let createdGroups = 0,
    convertedChildren = 0;
  for (const child of snapshot.children) {
    if (!child || !Object.hasOwn(child, 'group')) continue;
    const name = String(child.group || '').trim();
    delete child.group;
    convertedChildren++;
    if (!name) {
      child.groupId = null;
      continue;
    }
    if (!nameToId.has(name)) {
      const id = `GRP-${crypto.randomUUID()}`;
      nameToId.set(name, id);
      snapshot.groups.push({ id, name, capacity: null });
      createdGroups++;
    }
    child.groupId = nameToId.get(name);
  }
  if (convertedChildren)
    notes.push(
      `Format vechi, actualizat: ${createdGroups} ${createdGroups === 1 ? 'grupă creată' : 'grupe create'} din câmpul text al copiilor.`,
    );

  return { snapshot, notes };
}
