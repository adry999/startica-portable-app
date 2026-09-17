import { join } from 'node:path';
import { readJsonFile, writeJsonFileAtomically } from '#core/server/files/json-file.mjs';
import { removeFileIfPresent } from '#core/server/files/remove-file-if-present.mjs';

/** @typedef {import('../telegram-notify.types.mjs').TelegramConfig} TelegramConfig */

const CONFIG_FILE_NAME = 'telegram.json';

/** @param {string} dataDir */
export function telegramConfigFilePath(dataDir) {
  return join(dataDir, CONFIG_FILE_NAME);
}

/**
 * @param {string} dataDir
 * @returns {TelegramConfig | null}
 */
export function readTelegramConfig(dataDir) {
  return /** @type {TelegramConfig | null} */ (readJsonFile(telegramConfigFilePath(dataDir)));
}

/**
 * @param {string} dataDir
 * @param {TelegramConfig} config
 */
export function writeTelegramConfig(dataDir, config) {
  writeJsonFileAtomically(telegramConfigFilePath(dataDir), config);
}

/** @param {string} dataDir */
export function removeTelegramConfig(dataDir) {
  removeFileIfPresent(telegramConfigFilePath(dataDir));
}
