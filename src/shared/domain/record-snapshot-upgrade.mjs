import { TYPES, emptyState, missingDefaultServiceSeeds } from './record-schema.mjs';
import { missingDefaultCategorySeeds, missingExpenseOnlyCategorySeeds } from './expense-categories.mjs';
import { today } from './calendar-month.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */

// Aceeași regulă ca migrarea 002: fără ea, validateState() pierde grupele din backupurile și exporturile vechi.
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

  // Note vechi (migrarea 003 din baza SQLite face același lucru la nivel de bază — aici e
  // varianta pentru un export/backup adus dintr-o instalare care nu a trecut încă prin ea).
  const todayStr = today();
  let convertedNotes = 0;
  for (const child of snapshot.children) {
    if (!child || typeof child.notes !== 'string') continue;
    const text = child.notes.trim();
    child.notes = text ? [{ id: `NOTE-${crypto.randomUUID()}`, text, date: todayStr }] : [];
    convertedNotes++;
  }
  if (convertedNotes) notes.push(`Format vechi, actualizat: ${convertedNotes} notă/note de copii mutate în listă.`);

  // Un import sau o restaurare poate readuce un instantaneu fără categoriile implicite
  // (backup vechi, dinainte ca ele să fie înregistrări reale) sau cu cheltuieli a căror
  // categorie era doar text — completate aici, ca nimic să nu rămână „în aer” și fără
  // să depindă de faptul că filiala a fost deja deschisă o dată după actualizare.
  // Un backup/export dinainte de B3 nu are `services` — Grădiniță/Bazin lipsesc, dar orice
  // plată din el se normalizează cu `service: 'gradinita'` (record-schema.mjs); fără semințe
  // aici, ar rămâne o referință moartă până la prima deschidere a filialei (seedServices).
  const defaultServiceSeeds = missingDefaultServiceSeeds(snapshot);
  for (const seed of defaultServiceSeeds) snapshot.services.push(seed);
  if (defaultServiceSeeds.length)
    notes.push(`Servicii implicite completate: ${defaultServiceSeeds.length} (Grădiniță/Bazin, dacă lipseau).`);

  const defaultSeeds = missingDefaultCategorySeeds(snapshot);
  for (const seed of defaultSeeds) snapshot.categories.push(seed);
  const migratedSeeds = missingExpenseOnlyCategorySeeds(snapshot);
  for (const seed of migratedSeeds) snapshot.categories.push(seed);
  if (defaultSeeds.length)
    notes.push(`Categorii implicite completate: ${defaultSeeds.length} (inclusiv „General”, dacă lipsea).`);
  if (migratedSeeds.length)
    notes.push(
      `Categorii create din cheltuieli fără categorie proprie: ${migratedSeeds.length} (${migratedSeeds.map(seed => seed.name).join(', ')}).`,
    );

  return { snapshot, notes };
}
