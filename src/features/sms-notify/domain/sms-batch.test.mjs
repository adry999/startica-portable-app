import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseSmsRecipient, finalizeSmsText, planSmsBatch, estimateSmsCost } from './sms-batch.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */

/** @param {Partial<Child>} overrides @returns {Child} */
function child(overrides = {}) {
  return {
    id: 'c1',
    name: 'Ion Popescu',
    parent: 'Maria Popescu',
    phone: '069123456',
    groupId: null,
    status: 'Activ',
    statusHistory: [],
    fee: null,
    feeHistory: [],
    dueDay: 10,
    ...overrides,
  };
}

const obligation = { expected: 500, paid: 100, rest: 400, due: '2026-09-05' };

test('chooseSmsRecipient alege părintele 1 când are telefon valid', () => {
  assert.deepEqual(chooseSmsRecipient(child()), { parentLabel: 'Maria Popescu', phone: '+37369123456' });
});

test('chooseSmsRecipient cade pe părintele 2 când primul nu are telefon valid', () => {
  const result = chooseSmsRecipient(child({ phone: '', parent2: 'Ion Tată', phone2: '078123456' }));
  assert.deepEqual(result, { parentLabel: 'Ion Tată', phone: '+37378123456' });
});

test('chooseSmsRecipient întoarce null când niciun părinte nu are telefon valid', () => {
  assert.equal(chooseSmsRecipient(child({ phone: 'abc', parent2: '', phone2: '' })), null);
});

test('finalizeSmsText strips diacritics before counting, encoding devine gsm-7', () => {
  const { text, encoding } = finalizeSmsText('Bună ziua, Ștefan!', true);
  assert.ok(!text.includes('ă'));
  assert.equal(encoding, 'gsm-7');
});

test('finalizeSmsText fără stripDiacritics rămâne ucs-2 pe diacritice', () => {
  const { text, encoding } = finalizeSmsText('Bună ziua, Ștefan!', false);
  assert.equal(text, 'Bună ziua, Ștefan!');
  assert.equal(encoding, 'ucs-2');
});

test('estimateSmsCost rotunjește la 2 zecimale', () => {
  assert.equal(estimateSmsCost(3, 0.3), 0.9);
});

test('planSmsBatch produce un mesaj per copil, exclude fără telefon valid, adună segmentele', () => {
  const rows = [
    { child: child(), obligation },
    { child: child({ id: 'c2', name: 'Ana Ionescu', phone: 'invalid', parent2: '', phone2: '' }), obligation },
  ];
  const plan = planSmsBatch({
    rows,
    body: 'Bună ziua, {părinte}! Rest: {rest}.',
    stripDiacritics: true,
    month: '2026-09',
  });
  assert.equal(plan.messages.length, 1);
  assert.equal(plan.messages[0].childId, 'c1');
  assert.equal(plan.messages[0].phone, '+37369123456');
  assert.deepEqual(plan.excluded, [{ childId: 'c2', childName: 'Ana Ionescu', reason: 'Fără telefon valid' }]);
  assert.equal(plan.totalSegments, plan.messages[0].segments);
});
