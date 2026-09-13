import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { childNameOf, groupNameOf } from '#shared/domain/record-labels.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordType} RecordType */
/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */

// Un singur set de câmpuri pentru toate cele trei liste (Copii, Achitări,
// Cheltuieli): fiecare rând conține doar câmpurile relevante tipului lui, deci
// restul intră în JSON ca `null` — la fel pentru toate tipurile, deci nu
// influențează diferit potrivirea. Căutarea automată a asocierii (nume din
// sursă → copil) folosește aceeași potrivire, ca rezultatele să fie identice.
/**
 * @param {RecordType} listId
 * @param {any} row
 * @param {RecordsSnapshot} records
 * @param {string} normalizedSearch deja normalizat (fără diacritice, minuscule) — vezi normalizeSearchText
 */
export function matchesRecordListSearch(listId, row, records, normalizedSearch) {
  if (!normalizedSearch) return true;
  return normalizeSearchText(
    JSON.stringify([
      row.name,
      row.parent,
      row.phone,
      row.parent2,
      row.phone2,
      listId === 'children' ? groupNameOf(row.groupId, records.groups) : row.group,
      row.id,
      row.contractNumber,
      row.notes,
      row.description,
      row.category,
      listId === 'payments' ? childNameOf(row, records.children) : '',
    ]),
  ).includes(normalizedSearch);
}
