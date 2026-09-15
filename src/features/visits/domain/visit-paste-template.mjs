import { normalizeSearchText } from '#shared/format/text-search.mjs';

// Șablonul e completat de mână (pe hârtie sau în telefon) în timpul apelului cu
// părintele, deci etichetele pot varia la diacritice, majuscule, spații și formulare
// naturală ("Nume copil" în loc de "Copil"). Datele acceptă atât AAAA-LL-ZZ, cât și
// scrierea românească uzuală ZZ.LL.AAAA — formatul ZZ/LL/AAAA rămâne respins, e ambiguu.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RO_DATE_PATTERN = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
const DATE_FIELDS = new Set(['birthDate', 'date', 'desiredStartDate']);

// Etichetele canonice, în ordinea din formular — sursă unică pentru harta de
// potrivire și pentru VISIT_PASTE_TEMPLATE, ca cele două să nu poată diverge.
/** @type {[string, string][]} */
const CANONICAL_FIELDS = [
  ['Copil', 'name'],
  ['Data nașterii', 'birthDate'],
  ['Părinte 1', 'parent'],
  ['Telefon 1', 'phone'],
  ['Părinte 2', 'parent2'],
  ['Telefon 2', 'phone2'],
  ['Data vizitei', 'date'],
  ['Ora', 'time'],
  ['Data dorită start', 'desiredStartDate'],
  ['Grupa dorită', 'desiredGroupId'],
  ['Cum a aflat', 'source'],
];

// Sinonime pe care un operator le-ar scrie firesc în loc de eticheta canonică.
// „data” e sigur ca alias exact al „datei vizitei”: „data nașterii”/„data dorită
// start” se potrivesc doar ca etichetă întreagă, nu ca subșir, deci nu se ciocnesc.
const ALIAS_FIELDS = {
  'nume copil': 'name',
  nume: 'name',
  'nume parinte': 'parent',
  parinte: 'parent',
  telefon: 'phone',
  vizita: 'date',
  data: 'date',
};

/** @type {Map<string, string>} */
const FIELD_BY_LABEL = new Map([
  ...CANONICAL_FIELDS.map(([label, field]) => /** @type {[string, string]} */ ([normalizeSearchText(label), field])),
  ...Object.entries(ALIAS_FIELDS),
]);

// Textul de copiat pentru operator: etichetele canonice, gata de completat manual.
export const VISIT_PASTE_TEMPLATE = CANONICAL_FIELDS.map(([label]) => `${label}: \n`).join('');

/**
 * @param {string} value
 * @returns {string | null}
 */
function parseDateValue(value) {
  if (ISO_DATE_PATTERN.test(value)) return value;
  const match = RO_DATE_PATTERN.exec(value);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealCalendarDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!isRealCalendarDate) return null;
  return `${match[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

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
      const isoDate = parseDateValue(value);
      if (isoDate) result[field] = isoDate;
      continue;
    }
    result[field] = value;
  }
  return result;
}
