import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearchText } from '#shared/format/text-search.mjs';
import { matchesRecordListSearch } from './record-list-search.mjs';

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
 * @param {Partial<import('#shared/contracts/record-types.mjs').Payment>} overrides
 * @returns {import('#shared/contracts/record-types.mjs').Payment}
 */
function basePayment(overrides = {}) {
  return {
    id: 'p1',
    date: '2026-09-01',
    childId: '',
    month: '',
    method: 'Cash',
    amount: 0,
    allocations: [],
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

/**
 * @param {Partial<import('#shared/contracts/record-types.mjs').RecordsSnapshot>} overrides
 * @returns {import('#shared/contracts/record-types.mjs').RecordsSnapshot}
 */
function baseRecords(overrides = {}) {
  return { children: [], payments: [], expenses: [], groups: [], categories: [], visits: [], ...overrides };
}

test('un termen gol se potrivește mereu', () => {
  assert.equal(matchesRecordListSearch('children', baseChild({ name: 'Ana' }), baseRecords(), ''), true);
});

test('caută în numele copilului, fără diacritice și fără sensibilitate la majuscule', () => {
  const child = baseChild({ id: 'c1', name: 'Ștefan' });
  assert.equal(matchesRecordListSearch('children', child, baseRecords(), normalizeSearchText('stefan')), true);
  assert.equal(matchesRecordListSearch('children', child, baseRecords(), normalizeSearchText('STEFAN')), true);
  assert.equal(matchesRecordListSearch('children', child, baseRecords(), normalizeSearchText('altceva')), false);
});

test('caută în numele grupei pentru copii, prin groupId', () => {
  const records = baseRecords({ groups: [baseGroup({ id: 'g1', name: 'Fluturași' })] });
  const child = baseChild({ id: 'c1', name: 'Ana', groupId: 'g1' });
  assert.equal(matchesRecordListSearch('children', child, records, normalizeSearchText('fluturasi')), true);
});

test('caută în numele copilului asociat pentru achitări, prin childId', () => {
  const records = baseRecords({ children: [baseChild({ id: 'c1', name: 'Ana' })] });
  const payment = basePayment({ id: 'p1', childId: 'c1', amount: 100 });
  assert.equal(matchesRecordListSearch('payments', payment, records, normalizeSearchText('ana')), true);
});

test('caută în categoria și descrierea unei cheltuieli', () => {
  const expense = { id: 'e1', category: 'Utilități', description: 'Curent electric' };
  assert.equal(matchesRecordListSearch('expenses', expense, baseRecords(), normalizeSearchText('utilitati')), true);
  assert.equal(matchesRecordListSearch('expenses', expense, baseRecords(), normalizeSearchText('curent')), true);
  assert.equal(matchesRecordListSearch('expenses', expense, baseRecords(), normalizeSearchText('gaz')), false);
});
