import { join } from 'node:path';
import { readJsonFile, writeJsonFileAtomically } from '#core/server/files/json-file.mjs';
import { removeFileIfPresent } from '#core/server/files/remove-file-if-present.mjs';

/** @typedef {import('../sms-notify.types.mjs').SmsConfig} SmsConfig */

const CONFIG_FILE_NAME = 'sms.json';

/** @param {string} dataDir */
export function smsConfigFilePath(dataDir) {
  return join(dataDir, CONFIG_FILE_NAME);
}

/**
 * @param {string} dataDir
 * @returns {SmsConfig | null}
 */
export function readSmsConfig(dataDir) {
  return /** @type {SmsConfig | null} */ (readJsonFile(smsConfigFilePath(dataDir)));
}

/**
 * @param {string} dataDir
 * @param {SmsConfig} config
 */
export function writeSmsConfig(dataDir, config) {
  writeJsonFileAtomically(smsConfigFilePath(dataDir), config);
}

/** @param {string} dataDir */
export function removeSmsConfig(dataDir) {
  removeFileIfPresent(smsConfigFilePath(dataDir));
}

/** @param {string} token */
export const maskSmsToken = token => (token ? '••••••••' + token.slice(-4) : '');
