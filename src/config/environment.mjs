// Copia integrală a bazei nu are ce căuta pe calea fiecărei salvări (vezi features/backup/server/backup.service.mjs).
export const DEFAULT_AUTO_BACKUP_INTERVAL_MS = 300000;

/** @typedef {'development' | 'test' | 'production'} EnvironmentProfile */

/**
 * @typedef {object} StarticaEnvironment
 * @property {EnvironmentProfile} profile
 * @property {number} port 0 = port liber ales de sistem
 * @property {boolean} openBrowser
 * @property {number} autoBackupIntervalMs 0 = backup la fiecare scriere
 */

const PROFILE_DEFAULTS = {
  development: { port: 8765, openBrowser: true, autoBackupIntervalMs: DEFAULT_AUTO_BACKUP_INTERVAL_MS },
  test: { port: 0, openBrowser: false, autoBackupIntervalMs: 0 },
  production: { port: 8765, openBrowser: false, autoBackupIntervalMs: DEFAULT_AUTO_BACKUP_INTERVAL_MS },
};

/**
 * @param {string | undefined} rawPort
 * @param {number} defaultPort
 */
function parsePort(rawPort, defaultPort) {
  if (rawPort === undefined) return defaultPort;
  const port = Number(rawPort);
  if (!/^\d{1,5}$/.test(rawPort) || port > 65535)
    throw new Error(`STARTICA_PORT invalid: „${rawPort}”. Folosește un număr între 0 și 65535.`);
  return port;
}

/**
 * Singurul loc care citește variabilele de mediu ale aplicației; valorile greșite opresc pornirea.
 * @param {Record<string, string | undefined>} [variables]
 * @returns {Readonly<StarticaEnvironment>}
 */
export function loadEnvironment(variables = process.env) {
  const profile = variables.STARTICA_PROFILE ?? 'development';
  if (!Object.hasOwn(PROFILE_DEFAULTS, profile))
    throw new Error(
      `STARTICA_PROFILE necunoscut: „${profile}”. Folosește ${Object.keys(PROFILE_DEFAULTS).join(', ')}.`,
    );
  const defaults = PROFILE_DEFAULTS[profile];
  return Object.freeze({
    profile: /** @type {EnvironmentProfile} */ (profile),
    port: parsePort(variables.STARTICA_PORT, defaults.port),
    openBrowser: variables.STARTICA_NO_BROWSER === '1' ? false : defaults.openBrowser,
    autoBackupIntervalMs: defaults.autoBackupIntervalMs,
  });
}
