/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('#shared/contracts/persistence.mjs').RecordRepository} RecordRepository */

const RECORD_TYPES = ['children', 'payments', 'expenses', 'groups', 'categories', 'visits'];

// Clonează la intrare și la ieșire, ca un test să nu poată modifica „baza” prin referință.
/**
 * @param {Partial<RecordsSnapshot>} [initialRecords]
 * @returns {RecordRepository & { currentRevision(): number }}
 */
export function createInMemoryRecordRepository(initialRecords = {}) {
  const recordsByType = new Map(
    RECORD_TYPES.map(type => [
      type,
      new Map((initialRecords[type] ?? []).map(record => [record.id, structuredClone(record)])),
    ]),
  );
  // Crește la fiecare scriere; suficient pt. testele care au nevoie de un număr, fără să
  // reproducă semantica „o creștere per tranzacție” din baza reală.
  let revision = 0;

  /** @param {string} type */
  function recordsOf(type) {
    const records = recordsByType.get(type);
    if (!records) throw new TypeError(`Tip de înregistrare necunoscut: ${type}`);
    return records;
  }

  /** @param {string} type */
  const snapshotOf = type => structuredClone([...recordsOf(type).values()]);

  return {
    find: (type, id) => structuredClone(recordsOf(type).get(id)),
    exists: (type, id) => recordsOf(type).has(id),
    save: (type, record) => {
      recordsOf(type).set(record.id, structuredClone(record));
      revision++;
    },
    remove: (type, id) => {
      recordsOf(type).delete(id);
      revision++;
    },
    readSnapshot: () => ({
      children: snapshotOf('children'),
      payments: snapshotOf('payments'),
      expenses: snapshotOf('expenses'),
      groups: snapshotOf('groups'),
      categories: snapshotOf('categories'),
      visits: snapshotOf('visits'),
    }),
    currentRevision: () => revision,
  };
}
