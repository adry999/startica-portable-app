import { normalizeRecord } from '#shared/domain/record-schema.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Visit} Visit */
/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */

/** @param {Partial<Visit>} [overrides]
 *  @returns {Visit} */
export function scheduledVisit(overrides = {}) {
  return normalizeRecord('visits', {
    id: 'VIZ-1',
    name: 'Popescu Ana',
    parent: 'Popescu Ion',
    phone: '0722000000',
    date: '2026-09-20',
    time: '10:00',
    status: 'Programată',
    statusChangedAt: '2026-09-10T08:00:00.000Z',
    healthNotes: 'Alergie la nuci',
    ...overrides,
  });
}

/** Fișa nouă trimisă de editorul precompletat la înscriere.
 *  @param {Partial<Child>} [overrides]
 *  @returns {Child} */
export function newChildInput(overrides = {}) {
  return {
    id: 'CH-NOU',
    name: 'Popescu Ana',
    parent: 'Popescu Ion',
    phone: '0722000000',
    groupId: null,
    status: 'Activ',
    statusHistory: [],
    fee: null,
    feeHistory: [],
    dueDay: 10,
    healthNotes: '',
    ...overrides,
  };
}

/** @returns {RecordsSnapshot} */
export function createVisitsRecords() {
  return {
    children: [],
    payments: [],
    expenses: [],
    groups: [{ id: 'GRP-MICI', name: 'Grupa mică', capacity: 15 }],
    categories: [],
    visits: [scheduledVisit()],
  };
}
