import test from 'node:test';
import assert from 'node:assert/strict';
import { createPinService } from './pin.service.mjs';

function createSettingsStore() {
  const store = new Map();
  return {
    readSetting: key => store.get(key) || '',
    writeSetting: (key, value) => store.set(key, value),
  };
}

test('set configurează PIN-ul fără PIN curent, apoi cere PIN-ul curent la schimbare', () => {
  const { readSetting, writeSetting } = createSettingsStore();
  const pinSession = { unlockedUntil: 0, failedAttempts: 0, lockedUntil: 0 };
  const service = createPinService({ readSetting, writeSetting, pinSession });

  assert.equal(service.isConfigured(), false);
  service.set({ pin: '1234' });
  assert.equal(service.isConfigured(), true);

  assert.throws(() => service.set({ pin: '5678' }), /greșit/);
  service.set({ pin: '5678', currentPin: '1234' });
  assert.throws(() => service.unlock('1234'), /incorect/i);
  service.unlock('5678');
});

test('unlock deblochează 10 minute, assertUnlocked prelungește, iar 403 apare fără deblocare', () => {
  let nowMs = Date.parse('2026-09-27T10:00:00.000Z');
  const now = () => new Date(nowMs);
  const { readSetting, writeSetting } = createSettingsStore();
  const pinSession = { unlockedUntil: 0, failedAttempts: 0, lockedUntil: 0 };
  const service = createPinService({ readSetting, writeSetting, pinSession, now });
  service.set({ pin: '1234' });

  assert.throws(() => service.assertUnlocked(), /403|protejate/i);

  service.unlock('1234');
  assert.equal(service.status().unlocked, true);

  nowMs += 9 * 60 * 1000;
  service.assertUnlocked(); // prelungește
  nowMs += 9 * 60 * 1000;
  assert.doesNotThrow(() => service.assertUnlocked());

  nowMs += 11 * 60 * 1000;
  assert.throws(() => service.assertUnlocked());
});

test('5 greșeli blochează 15 minute, apoi permite din nou', () => {
  let nowMs = Date.parse('2026-09-27T10:00:00.000Z');
  const now = () => new Date(nowMs);
  const { readSetting, writeSetting } = createSettingsStore();
  const pinSession = { unlockedUntil: 0, failedAttempts: 0, lockedUntil: 0 };
  const service = createPinService({ readSetting, writeSetting, pinSession, now });
  service.set({ pin: '1234' });

  for (let attempt = 0; attempt < 5; attempt++) assert.throws(() => service.unlock('0000'));
  /** @type {any} */
  let lockedError;
  try {
    service.unlock('1234');
  } catch (error) {
    lockedError = error;
  }
  assert.equal(lockedError?.status, 429);
  assert.match(lockedError?.message ?? '', /15 minute/);

  nowMs += 15 * 60 * 1000 - 1000;
  assert.throws(() => service.unlock('1234'), /429|minute/i);

  nowMs += 2000;
  assert.doesNotThrow(() => service.unlock('1234'));
});

test('lock() șterge deblocarea imediat', () => {
  const { readSetting, writeSetting } = createSettingsStore();
  const pinSession = { unlockedUntil: 0, failedAttempts: 0, lockedUntil: 0 };
  const service = createPinService({ readSetting, writeSetting, pinSession });
  service.set({ pin: '1234' });
  service.unlock('1234');
  assert.equal(service.status().unlocked, true);
  service.lock();
  assert.equal(service.status().unlocked, false);
});
