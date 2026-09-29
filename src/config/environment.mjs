import { isAbsolute, join } from 'node:path';

// Copia integrală a bazei nu are ce căuta pe calea fiecărei salvări (vezi features/backup/server/backup.service.mjs).
export const DEFAULT_AUTO_BACKUP_INTERVAL_MS = 300000;

// Folderul filialelor create din aplicație (Faza 6) și numele registrului lor,
// amândouă relative la STARTICA_HOME — vezi core/server/branches/.
export const BRANCHES_DIR_NAME = 'Filiale';
export const BRANCH_REGISTRY_FILE_NAME = 'filiale.json';

// Baza instalării (personal, comun ambelor filiale — docs/superpowers/plans/2026-09-27-personal-bazin.md,
// decizia 1), lângă filiale.json, niciodată folderul vreunei filiale.
export const COMMON_DIR_NAME = 'Comun';

// Id-ul ei de dataset pentru sincronizare (decizia 9 din același plan, „Changes to the sync
// plan”): fix, nu un id de filială — sync-server/src/change-policy.mjs ține o copie identică,
// COMMON_DATASET_ID (sync-server/ nu importă din src/, ca RECORD_KINDS — vezi
// tests/sync-shared-constants.test.mjs). Folosit doar din src/app/ (features/ nu importă
// #config/, vezi tests/architecture/import-boundary-rules.mjs) — restul primește valoarea
// ca parametru injectat.
export const COMMON_DATASET_ID = 'comun';

// Identitatea de dispozitiv pentru sincronizare (docs/superpowers/plans/2026-09-27-sincronizare.md,
// decizia 2), tot per instalare, lângă filiale.json — nu per filială.
export const SYNC_DEVICE_FILE_NAME = 'sync.json';

/** @typedef {'development' | 'test' | 'production'} EnvironmentProfile */

/**
 * @typedef {object} StarticaEnvironment
 * @property {EnvironmentProfile} profile
 * @property {number} port 0 = port liber ales de sistem
 * @property {boolean} openBrowser
 * @property {number} autoBackupIntervalMs 0 = backup la fiecare scriere
 * @property {string | undefined} home rădăcina de date a lansatorului desktop; absentă = folderul aplicației
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
 * @param {string | undefined} rawHome
 */
function parseHome(rawHome) {
  if (rawHome === undefined) return undefined;
  if (!rawHome || !isAbsolute(rawHome))
    throw new Error(`STARTICA_HOME invalid: „${rawHome}”. Folosește o cale absolută.`);
  return rawHome;
}

/** Folderele aplicației față de rădăcina de date (lansator: STARTICA_HOME; dezvoltare: folderul aplicației).
 * @param {string} home
 */
export function dataLayout(home) {
  return {
    dataDir: join(home, 'Startica_Date'),
    backupDir: join(home, 'Startica_Backup'),
    logDir: join(home, 'Jurnale'),
  };
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
    home: parseHome(variables.STARTICA_HOME),
  });
}
