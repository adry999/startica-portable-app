/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */

/**
 * @typedef {object} MissingChildField
 * @property {'phone' | 'plan' | 'groupId' | 'birthDate' | 'parent2' | 'idnp' | 'pickupPerson'} key
 * @property {string} label
 * @property {boolean} required
 */

// Lista exactă din PROMPT-CLAUDE-CODE-8.md §9/41a: obligatorii = telefon părinte 1, plan, grupă,
// data nașterii; recomandate = părinte 2, IDNP, persoană autorizată. Ordinea e cea din spec,
// obligatoriile înaintea recomandatelor, ca banda din fișă să arate întâi ce blochează.
/** @type {{ key: MissingChildField['key'], label: string, required: boolean, isMissing: (child: Child) => boolean }[]} */
const FIELD_CHECKS = [
  { key: 'phone', label: 'Telefon părinte 1', required: true, isMissing: child => !child.phone?.trim() },
  { key: 'plan', label: 'Plan', required: true, isMissing: child => child.fee == null },
  { key: 'groupId', label: 'Grupă', required: true, isMissing: child => !child.groupId },
  { key: 'birthDate', label: 'Data nașterii', required: true, isMissing: child => !child.birthDate },
  { key: 'parent2', label: 'Părinte 2', required: false, isMissing: child => !child.parent2?.trim() },
  { key: 'idnp', label: 'IDNP', required: false, isMissing: child => !child.idnp?.trim() },
  {
    key: 'pickupPerson',
    label: 'Persoană autorizată',
    required: false,
    isMissing: child => !(child.pickupPersons ?? []).length,
  },
];

/**
 * Câmpurile care lipsesc dintr-o fișă de copil (41a) — pură, folosită atât de banda din
 * `ChildProfileView` cât și de filtrul „Date incomplete” din Copii.
 * @param {Child} child
 * @returns {MissingChildField[]}
 */
export function missingChildFields(child) {
  return FIELD_CHECKS.filter(({ isMissing }) => isMissing(child)).map(({ key, label, required }) => ({
    key,
    label,
    required,
  }));
}
