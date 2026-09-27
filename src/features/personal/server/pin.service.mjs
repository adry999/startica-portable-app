import { createHash, randomBytes } from 'node:crypto';
import { fail } from '#core/server/errors/domain-error.mjs';

const PIN_SETTING_KEY = 'adminPin';
const PIN_OK = /^\d{4,6}$/;
const UNLOCK_DURATION_MS = 10 * 60 * 1000;
const LOCKOUT_DURATION_MS = 60 * 1000;
const MAX_FAILURES = 5;
const PROTECTED_MESSAGE = 'Salariile sunt protejate. Introdu PIN-ul.';

/** @param {string} pin @param {string} salt */
const hashPin = (pin, salt) =>
  createHash('sha256')
    .update(salt + pin)
    .digest('hex');

/**
 * O cortină, nu securitate (decizia 8): PIN-ul stă în `comun` (`adminPin = { salt, hash }`),
 * deblocarea trăiește doar în procesul curent (`pinSession`, un obiect mutabil ținut de
 * `createCommonContext`, nu persistat). 5 greșeli → blocaj de 60 s; deblocarea se prelungește
 * 10 minute la fiecare cerere protejată reușită.
 * @param {{
 *   readSetting: (key: string) => string,
 *   writeSetting: (key: string, value: string) => void,
 *   pinSession: { unlockedUntil: number, failedAttempts: number, lockedUntil: number },
 *   now?: () => Date,
 * }} dependencies
 */
export function createPinService({ readSetting, writeSetting, pinSession, now = () => new Date() }) {
  function readStored() {
    const raw = readSetting(PIN_SETTING_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  const isConfigured = () => !!readStored();

  /** @param {{ pin: string, currentPin?: string }} input @returns {{ ok: true }} */
  function set({ pin, currentPin }) {
    if (!PIN_OK.test(String(pin))) fail('PIN-ul trebuie să aibă 4–6 cifre.');
    const stored = readStored();
    if (stored && (!currentPin || hashPin(currentPin, stored.salt) !== stored.hash))
      fail('PIN-ul curent este greșit.', 403);
    const salt = randomBytes(16).toString('hex');
    writeSetting(PIN_SETTING_KEY, JSON.stringify({ salt, hash: hashPin(pin, salt) }));
    return { ok: true };
  }

  /** @returns {{ ok: true }} */
  function lock() {
    pinSession.unlockedUntil = 0;
    return { ok: true };
  }

  /** @param {string} pin @returns {{ ok: true }} */
  function unlock(pin) {
    const stored = readStored();
    if (!stored) fail('PIN-ul nu este configurat — setează unul în Backup și setări.');
    const nowMs = now().getTime();
    if (pinSession.lockedUntil && nowMs < pinSession.lockedUntil)
      fail('Prea multe încercări greșite. Așteaptă un minut.', 429);
    if (hashPin(String(pin), stored.salt) !== stored.hash) {
      pinSession.failedAttempts = (pinSession.failedAttempts || 0) + 1;
      if (pinSession.failedAttempts >= MAX_FAILURES) {
        pinSession.lockedUntil = nowMs + LOCKOUT_DURATION_MS;
        pinSession.failedAttempts = 0;
      }
      fail('PIN incorect.', 403);
    }
    pinSession.failedAttempts = 0;
    pinSession.lockedUntil = 0;
    pinSession.unlockedUntil = nowMs + UNLOCK_DURATION_MS;
    return { ok: true };
  }

  // Apelat de fiecare rută protejată; aruncă 403 dacă blocată — nu are voie să dea 429 aici,
  // 429-ul e doar răspunsul lui unlock() cât timp blocajul de 5 greșeli e activ.
  function assertUnlocked() {
    const nowMs = now().getTime();
    if (!pinSession.unlockedUntil || nowMs > pinSession.unlockedUntil) fail(PROTECTED_MESSAGE, 403);
    pinSession.unlockedUntil = nowMs + UNLOCK_DURATION_MS;
  }

  /** @returns {{ configured: boolean, unlocked: boolean }} */
  function status() {
    const nowMs = now().getTime();
    return { configured: isConfigured(), unlocked: !!pinSession.unlockedUntil && nowMs <= pinSession.unlockedUntil };
  }

  return { isConfigured, set, unlock, lock, assertUnlocked, status };
}
