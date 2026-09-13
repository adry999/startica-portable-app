import test from 'node:test';
import assert from 'node:assert/strict';
import { listHeadMarkup, applyManualSort, readListSortValue, sortListRows } from './record-list-sort.mjs';

const HEADINGS = ['<input>', 'Contract', 'Copil'];
const SORT_FIELDS = [null, 'contract', 'name'];

/**
 * @param {string | null} field
 * @param {'asc' | 'desc'} direction
 * @param {boolean} [manual]
 * @returns {import('./record-list-sort.mjs').ListSortState}
 */
function sortState(field, direction, manual = false) {
  return { field, direction, manual };
}

/**
 * @param {Partial<import('#shared/contracts/record-types.mjs').Child>} overrides
 * @returns {import('#shared/contracts/record-types.mjs').Child}
 */
function baseChild(overrides = {}) {
  return {
    id: 'c1',
    name: 'Copil Test',
    parent: '',
    phone: '',
    groupId: null,
    status: 'Activ',
    statusHistory: [],
    fee: null,
    feeHistory: [],
    dueDay: 10,
    ...overrides,
  };
}

/**
 * @param {Partial<import('#shared/contracts/record-types.mjs').Group>} overrides
 * @returns {import('#shared/contracts/record-types.mjs').Group}
 */
function baseGroup(overrides = {}) {
  return { id: 'g1', name: 'Grupă Test', capacity: null, ...overrides };
}

test('listHeadMarkup lasă coloanele fără câmp de sortare fără buton', () => {
  const markup = listHeadMarkup('children', HEADINGS, SORT_FIELDS, sortState('name', 'asc'));
  assert.ok(markup.startsWith('<tr><th><input></th>'));
});

test('listHeadMarkup marchează coloana activă doar când sortarea e manuală', () => {
  const automatic = listHeadMarkup('children', HEADINGS, SORT_FIELDS, sortState('name', 'asc', false));
  assert.ok(automatic.includes('aria-sort="none"'));
  assert.ok(automatic.includes('↕'));

  const manualAsc = listHeadMarkup('children', HEADINGS, SORT_FIELDS, sortState('name', 'asc', true));
  assert.ok(manualAsc.includes('aria-sort="ascending"'));
  assert.ok(manualAsc.includes('↑'));

  const manualDesc = listHeadMarkup('children', HEADINGS, SORT_FIELDS, sortState('name', 'desc', true));
  assert.ok(manualDesc.includes('aria-sort="descending"'));
  assert.ok(manualDesc.includes('↓'));
});

test('applyManualSort ignoră un câmp care nu e sortabil pe listă', () => {
  const current = sortState('name', 'asc', false);
  assert.equal(applyManualSort(current, ['contract', 'name'], 'unknown', 'desc'), current);
});

test('applyManualSort marchează sortarea drept manuală', () => {
  const current = sortState('name', 'asc', false);
  assert.deepEqual(applyManualSort(current, ['contract', 'name'], 'contract', 'desc'), {
    field: 'contract',
    direction: 'desc',
    manual: true,
  });
});

test('readListSortValue citește contractul, numele sau id-ul de rezervă', () => {
  const records = { children: [], groups: [] };
  assert.equal(readListSortValue('contract', baseChild({ contractNumber: 'C1', id: 'x' }), records), 'C1');
  assert.equal(readListSortValue('contract', baseChild({ id: 'x' }), records), 'x');
  assert.equal(readListSortValue('name', baseChild({ name: 'Ana' }), records), 'Ana');
});

test('readListSortValue citește numele copilului pentru achitări și numele grupei pentru copii', () => {
  const records = {
    children: [baseChild({ id: 'c1', name: 'Ana' })],
    groups: [baseGroup({ id: 'g1', name: 'Fluturași' })],
  };
  assert.equal(readListSortValue('child', { childId: 'c1' }, records), 'Ana');
  assert.equal(readListSortValue('group', { groupId: 'g1' }, records), 'Fluturași');
});

test('readListSortValue cade pe câmpul brut al rândului pentru restul coloanelor', () => {
  const records = { children: [], groups: [] };
  assert.equal(readListSortValue('status', { status: 'Activ' }, records), 'Activ');
  assert.equal(readListSortValue('status', {}, records), '');
});

test('sortListRows sortează numeric crescător și descrescător', () => {
  const rows = [{ amount: 5 }, { amount: 1 }, { amount: 3 }];
  const readValue = (field, row) => row[field];
  assert.deepEqual(sortListRows([...rows], sortState('amount', 'asc'), readValue), [
    { amount: 1 },
    { amount: 3 },
    { amount: 5 },
  ]);
  assert.deepEqual(sortListRows([...rows], sortState('amount', 'desc'), readValue), [
    { amount: 5 },
    { amount: 3 },
    { amount: 1 },
  ]);
});

test('sortListRows sortează text cu localeCompare românesc, ignorând diacriticele', () => {
  const rows = [{ name: 'Ștefan' }, { name: 'Andrei' }, { name: 'Ana' }];
  const readValue = (field, row) => row[field];
  assert.deepEqual(sortListRows([...rows], sortState('name', 'asc'), readValue), [
    { name: 'Ana' },
    { name: 'Andrei' },
    { name: 'Ștefan' },
  ]);
});
