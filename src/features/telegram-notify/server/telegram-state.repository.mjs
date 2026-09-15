import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { removeFileIfPresent } from '#core/server/files/remove-file-if-present.mjs';

/** @typedef {import('../telegram-notify.types.mjs').TelegramState} TelegramState */

const STATE_FILE_NAME = 'telegram-stare.json';

/** @returns {TelegramState} */
function emptyState() {
  return { lastRun: '', lastSuccess: '', lastError: '', sentKeys: {} };
}

/** @param {string} dataDir */
export function telegramStateFilePath(dataDir) {
  return join(dataDir, STATE_FILE_NAME);
}

/**
 * @param {string} dataDir
 * @returns {TelegramState}
 */
export function readTelegramState(dataDir) {
  const file = telegramStateFilePath(dataDir);
  if (!existsSync(file)) return emptyState();
  try {
    return { ...emptyState(), ...JSON.parse(readFileSync(file, 'utf8')) };
  } catch (error) {
    console.error(`Fișierul ${file} este corupt: ${/** @type {Error} */ (error).message}`);
    return emptyState();
  }
}

/**
 * @param {string} dataDir
 * @param {TelegramState} state
 */
export function writeTelegramState(dataDir, state) {
  mkdirSync(dataDir, { recursive: true });
  const file = telegramStateFilePath(dataDir);
  writeFileSync(file + '.tmp', JSON.stringify(state));
  renameSync(file + '.tmp', file);
}

/** @param {string} dataDir */
export function removeTelegramState(dataDir) {
  removeFileIfPresent(telegramStateFilePath(dataDir));
}
