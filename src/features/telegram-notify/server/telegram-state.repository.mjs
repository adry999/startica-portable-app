import { join } from 'node:path';
import { readJsonFile, writeJsonFileAtomically } from '#core/server/files/json-file.mjs';
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
  return {
    ...emptyState(),
    .../** @type {Partial<TelegramState> | null} */ (readJsonFile(telegramStateFilePath(dataDir))),
  };
}

/**
 * @param {string} dataDir
 * @param {TelegramState} state
 */
export function writeTelegramState(dataDir, state) {
  writeJsonFileAtomically(telegramStateFilePath(dataDir), state);
}

/** @param {string} dataDir */
export function removeTelegramState(dataDir) {
  removeFileIfPresent(telegramStateFilePath(dataDir));
}
