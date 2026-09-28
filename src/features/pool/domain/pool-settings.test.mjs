import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePoolSettings, parsePoolSettings, slotTimes, POOL_SETTINGS_SEED } from './pool-settings.mjs';

test('validatePoolSettings acceptă semințele și refuză valori în afara intervalului', () => {
  assert.equal(validatePoolSettings(POOL_SETTINGS_SEED), true);
  assert.equal(validatePoolSettings({ ...POOL_SETTINGS_SEED, pricePerSession: 0 }), false);
  assert.equal(validatePoolSettings({ ...POOL_SETTINGS_SEED, hoursFrom: '11:30', hoursTo: '09:00' }), false);
  assert.equal(validatePoolSettings({ ...POOL_SETTINGS_SEED, coachPayMode: 'altceva' }), false);
  assert.equal(validatePoolSettings({ ...POOL_SETTINGS_SEED, seatsPerSlot: 0 }), false);
  assert.equal(validatePoolSettings({ ...POOL_SETTINGS_SEED, seatsPerSlot: null }), true);
});

test('itemsNote e opțional (setări salvate înainte de bonul de 58mm) și limitat la 300 de caractere', () => {
  const { itemsNote: _itemsNote, ...withoutItemsNote } = POOL_SETTINGS_SEED;
  assert.equal(validatePoolSettings(withoutItemsNote), true);
  assert.equal(validatePoolSettings({ ...POOL_SETTINGS_SEED, itemsNote: 'a'.repeat(301) }), false);
  assert.equal(validatePoolSettings({ ...POOL_SETTINGS_SEED, itemsNote: 'a'.repeat(300) }), true);
  const parsed = parsePoolSettings(JSON.stringify(withoutItemsNote));
  assert.equal(parsed?.itemsNote, '');
});

test('parsePoolSettings întoarce null pentru JSON lipsă sau invalid', () => {
  assert.equal(parsePoolSettings(''), null);
  assert.equal(parsePoolSettings('nu e json'), null);
  assert.equal(parsePoolSettings(JSON.stringify({ ...POOL_SETTINGS_SEED, pricePerSession: -1 })), null);
  assert.deepEqual(parsePoolSettings(JSON.stringify(POOL_SETTINGS_SEED)), POOL_SETTINGS_SEED);
});

test('slotTimes generează orele din durationMin în durationMin, între hoursFrom și hoursTo', () => {
  assert.deepEqual(slotTimes(POOL_SETTINGS_SEED), ['09:00', '09:30', '10:00', '10:30', '11:00']);
});
