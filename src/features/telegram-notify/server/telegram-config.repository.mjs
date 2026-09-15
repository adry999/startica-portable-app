import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
  const file = telegramConfigFilePath(dataDir);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Fișierul ${file} este corupt: ${/** @type {Error} */ (error).message}`);
    return null;
  }
}

/**
 * @param {string} dataDir
 * @param {TelegramConfig} config
 */
export function writeTelegramConfig(dataDir, config) {
  mkdirSync(dataDir, { recursive: true });
  const file = telegramConfigFilePath(dataDir);
  writeFileSync(file + '.tmp', JSON.stringify(config));
  renameSync(file + '.tmp', file);
}

/** @param {string} dataDir */
export function removeTelegramConfig(dataDir) {
  removeFileIfPresent(telegramConfigFilePath(dataDir));
}
