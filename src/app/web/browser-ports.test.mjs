import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationsPort, createRememberedKeysPort } from './browser-ports.mjs';

test('permission() întoarce "unsupported" când Notification lipsește', () => {
  const port = createNotificationsPort({ notificationApi: undefined });
  assert.equal(port.permission(), 'unsupported');
});

test('rememberedKeys.read() întoarce [] când stocarea aruncă sau conține JSON ne-listă', () => {
  const throwingStorage = /** @type {Storage} */ (
    /** @type {any} */ ({
      getItem: () => {
        throw new Error('blocat');
      },
    })
  );
  assert.deepEqual(createRememberedKeysPort('k', { storage: throwingStorage }).read(), []);

  const nonArrayStorage = /** @type {Storage} */ (
    /** @type {any} */ ({ getItem: () => JSON.stringify({ nu: 'e listă' }) })
  );
  assert.deepEqual(createRememberedKeysPort('k', { storage: nonArrayStorage }).read(), []);
});

test('write() înghite o stocare care aruncă', () => {
  const throwingStorage = /** @type {Storage} */ (
    /** @type {any} */ ({
      setItem: () => {
        throw new Error('blocat');
      },
    })
  );
  assert.doesNotThrow(() => createRememberedKeysPort('k', { storage: throwingStorage }).write(['a']));
});
