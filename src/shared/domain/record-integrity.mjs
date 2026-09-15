/** @typedef {import('#shared/contracts/record-types.mjs').RecordType} RecordType */
/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */

// Extras din /api/record: integritatea referențială și unicitatea numelui,
// verificate înainte de scriere. Erori simple (fără status): dispatcher-ul
// tratează orice eroare nestatusată ca 400, la fel ca fail() fără al doilea argument.

/**
 * @param {RecordType} type
 * @param {any} record
 * @param {(type: RecordType, id: string) => boolean} recordExists
 */
export function assertRecordReferencesExist(type, record, recordExists) {
  if (type === 'payments' && record.childId && !recordExists('children', record.childId))
    throw new Error('Copilul asociat nu există.');
  if (type === 'children' && record.groupId && !recordExists('groups', record.groupId))
    throw new Error('Grupa asociată nu există.');
  if (type === 'visits' && record.childId && !recordExists('children', record.childId))
    throw new Error('Copilul asociat nu există.');
  if (type === 'visits' && record.desiredGroupId && !recordExists('groups', record.desiredGroupId))
    throw new Error('Grupa dorită nu există.');
}

/**
 * @param {RecordType} type
 * @param {any} record
 * @param {Pick<RecordsSnapshot, 'groups' | 'categories'>} records
 */
export function assertUniqueName(type, record, records) {
  if (type === 'groups') {
    const clash = records.groups.some(
      g => g.id !== record.id && g.name.toLocaleLowerCase('ro-RO') === record.name.toLocaleLowerCase('ro-RO'),
    );
    if (clash) throw new Error('Există deja o grupă cu acest nume.');
  }
  if (type === 'categories') {
    const clash = records.categories.some(
      c => c.id !== record.id && c.name.toLocaleLowerCase('ro-RO') === record.name.toLocaleLowerCase('ro-RO'),
    );
    if (clash) throw new Error('Există deja o categorie cu acest nume.');
  }
}
