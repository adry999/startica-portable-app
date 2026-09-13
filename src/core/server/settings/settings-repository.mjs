/**
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {string} key
 */
export function readSettingValue(database, key) {
  return database.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;
}

/**
 * @param {import('node:sqlite').DatabaseSync} database
 * @param {string} key
 * @param {string} value
 */
export function writeSettingValue(database, key, value) {
  return database
    .prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, value);
}

/** @param {import('node:sqlite').DatabaseSync} database */
export function createSettingsRepository(database) {
  return {
    setting: key => readSettingValue(database, key) || '',
    setSetting: (key, value) => writeSettingValue(database, key, value),
  };
}
