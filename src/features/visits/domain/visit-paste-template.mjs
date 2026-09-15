import { normalizeSearchText } from '#shared/format/text-search.mjs';

// Șablonul e completat de mână (pe hârtie sau în telefon) în timpul apelului cu
// părintele, deci etichetele pot varia la diacritice, majuscule și spații —
// dar formatul datelor rămâne strict AAAA-LL-ZZ, ca să nu scriem o dată invalidă.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_FIELDS = new Set(['birthDate', 'date', 'desiredStartDate']);

const FIELD_BY_LABEL = new Map(
  Object.entries({
    copil: 'name',
    'data nasterii': 'birthDate',
    'parinte 1': 'parent',
    'telefon 1': 'phone',
    'parinte 2': 'parent2',
    'telefon 2': 'phone2',
    'data vizitei': 'date',
    ora: 'time',
    'data dorita start': 'desiredStartDate',
    'grupa dorita': 'desiredGroupId',
    'cum a aflat': 'source',
  }),
);

/**
 * @param {string} text
 * @param {{ groups?: Array<{ id: string, name: string }> }} [options]
 * @returns {Record<string, string>}
 */
export function parseVisitPasteTemplate(text, { groups = [] } = {}) {
  /** @type {Record<string, string>} */
  const result = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;
    const label = normalizeSearchText(line.slice(0, separatorIndex)).trim().replace(/\s+/g, ' ');
    const value = line.slice(separatorIndex + 1).trim();
    const field = FIELD_BY_LABEL.get(label);
    if (!field || !value) continue;
    if (field === 'desiredGroupId') {
      const group = groups.find(g => normalizeSearchText(g.name) === normalizeSearchText(value));
      if (group) result.desiredGroupId = group.id;
      continue;
    }
    if (DATE_FIELDS.has(field)) {
      if (ISO_DATE_PATTERN.test(value)) result[field] = value;
      continue;
    }
    result[field] = value;
  }
  return result;
}
