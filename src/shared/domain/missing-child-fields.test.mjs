import test from 'node:test';
import assert from 'node:assert/strict';
import { missingChildFields } from './missing-child-fields.mjs';

/** @param {Partial<import('#shared/contracts/record-types.mjs').Child>} [overrides] */
const completeChild = (overrides = {}) => ({
  id: 'C1',
  name: 'Ana Pop',
  parent: 'Maria Pop',
  phone: '+37369123456',
  parent2: 'Ion Pop',
  phone2: '+37369654321',
  groupId: 'G1',
  birthDate: '2020-01-01',
  idnp: '2000000000000',
  fee: 1500,
  dueDay: 10,
  pickupPersons: [{ id: 'P1', name: 'Bunica' }],
  status: 'Activ',
  statusHistory: [],
  feeHistory: [],
  ...overrides,
});

test('o fișă completă nu are câmpuri lipsă', () => {
  assert.deepEqual(missingChildFields(/** @type {any} */ (completeChild())), []);
});

test('telefon părinte 1 lipsă e obligatoriu', () => {
  const result = missingChildFields(/** @type {any} */ (completeChild({ phone: '' })));
  assert.deepEqual(result, [{ key: 'phone', label: 'Telefon părinte 1', required: true }]);
});

test('planul (taxa) lipsă e obligatoriu', () => {
  const result = missingChildFields(/** @type {any} */ (completeChild({ fee: null })));
  assert.deepEqual(result, [{ key: 'plan', label: 'Plan', required: true }]);
});

test('grupa lipsă e obligatorie', () => {
  const result = missingChildFields(/** @type {any} */ (completeChild({ groupId: null })));
  assert.deepEqual(result, [{ key: 'groupId', label: 'Grupă', required: true }]);
});

test('data nașterii lipsă e obligatorie', () => {
  const result = missingChildFields(/** @type {any} */ (completeChild({ birthDate: '' })));
  assert.deepEqual(result, [{ key: 'birthDate', label: 'Data nașterii', required: true }]);
});

test('părintele 2 lipsă e recomandat', () => {
  const result = missingChildFields(/** @type {any} */ (completeChild({ parent2: '' })));
  assert.deepEqual(result, [{ key: 'parent2', label: 'Părinte 2', required: false }]);
});

test('IDNP lipsă e recomandat', () => {
  const result = missingChildFields(/** @type {any} */ (completeChild({ idnp: '' })));
  assert.deepEqual(result, [{ key: 'idnp', label: 'IDNP', required: false }]);
});

test('nicio persoană autorizată e recomandat', () => {
  const result = missingChildFields(/** @type {any} */ (completeChild({ pickupPersons: [] })));
  assert.deepEqual(result, [{ key: 'pickupPerson', label: 'Persoană autorizată', required: false }]);
});

test('combinație: un obligatoriu și un recomandat, în ordinea obligatorii-întâi din spec', () => {
  const result = missingChildFields(/** @type {any} */ (completeChild({ groupId: null, idnp: '' })));
  assert.deepEqual(result, [
    { key: 'groupId', label: 'Grupă', required: true },
    { key: 'idnp', label: 'IDNP', required: false },
  ]);
});

test('fișă complet goală adună toate cele 7 câmpuri', () => {
  const result = missingChildFields(
    /** @type {any} */ ({
      id: 'C2',
      name: 'Nou',
      parent: '',
      phone: '',
      groupId: null,
      birthDate: '',
      fee: null,
      dueDay: 10,
      status: 'Activ',
      statusHistory: [],
      feeHistory: [],
    }),
  );
  assert.deepEqual(
    result.map(field => field.key),
    ['phone', 'plan', 'groupId', 'birthDate', 'parent2', 'idnp', 'pickupPerson'],
  );
});
