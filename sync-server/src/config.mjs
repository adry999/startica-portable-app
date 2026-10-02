import { isAbsolute, join } from 'node:path';

/**
 * @typedef {object} SyncServerConfig
 * @property {number} port
 * @property {string} bind
 * @property {string} dataDir
 * @property {string | undefined} setupKey
 * @property {boolean} setupKeyAlways
 * @property {number} backupHour
 * @property {number} backupKeep
 * @property {number} historyDays
 * @property {boolean} trustProxy
 * @property {string | undefined} minClientVersion
 */

// Doar forma X.Y.Z — nicio comparație semantică aici (version-compare.mjs face asta); o
// valoare greșită trebuie să oprească pornirea, nu să ajungă silențios la o comparație care
// întoarce mereu `null` (deci niciun client nu s-ar bloca niciodată, din greșeală).
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

const DEFAULT_PORT = 8790;
const DEFAULT_BIND = '127.0.0.1';
const DEFAULT_BACKUP_HOUR = 3;
const DEFAULT_BACKUP_KEEP = 14;
const DEFAULT_HISTORY_DAYS = 365;

/** @param {string | undefined} raw */
function parsePort(raw) {
  if (raw === undefined) return DEFAULT_PORT;
  const port = Number(raw);
  if (!/^\d{1,5}$/.test(raw) || port > 65535)
    throw new Error(`SYNC_PORT invalid: „${raw}”. Folosește un număr între 0 și 65535.`);
  return port;
}

/** @param {string | undefined} raw */
function parseBackupHour(raw) {
  if (raw === undefined) return DEFAULT_BACKUP_HOUR;
  const hour = Number(raw);
  if (!/^\d{1,2}$/.test(raw) || hour > 23)
    throw new Error(`SYNC_BACKUP_HOUR invalid: „${raw}”. Folosește un număr între 0 și 23.`);
  return hour;
}

/**
 * @param {string | undefined} raw
 * @param {string} name
 * @param {number} fallback
 */
function parsePositiveInt(raw, name, fallback) {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || value < 1) throw new Error(`${name} invalid: „${raw}”. Folosește un număr întreg pozitiv.`);
  return value;
}

/** @param {string | undefined} raw */
function parseMinClientVersion(raw) {
  if (raw === undefined) return undefined;
  if (!SEMVER_PATTERN.test(raw))
    throw new Error(`SYNC_MIN_CLIENT_VERSION invalid: „${raw}”. Folosește forma X.Y.Z.`);
  return raw;
}

/** @param {string | undefined} raw */
function parseDataDir(raw) {
  // Implicit: sync-server/data, relativ la rădăcina din care pornește procesul
  // (vezi README.md — `node sync-server/src/main.mjs` din rădăcina depozitului).
  if (raw === undefined) return join(process.cwd(), 'sync-server', 'data');
  if (!raw || !isAbsolute(raw)) throw new Error(`SYNC_DATA_DIR invalid: „${raw}”. Folosește o cale absolută.`);
  return raw;
}

/**
 * Singurul loc care citește variabilele de mediu ale serverului de sincronizare;
 * o valoare greșită oprește pornirea cu un mesaj clar (ca #config/environment.mjs din aplicație).
 * @param {Record<string, string | undefined>} [variables]
 * @returns {Readonly<SyncServerConfig>}
 */
export function loadSyncConfig(variables = process.env) {
  return Object.freeze({
    port: parsePort(variables.SYNC_PORT),
    bind: variables.SYNC_BIND || DEFAULT_BIND,
    dataDir: parseDataDir(variables.SYNC_DATA_DIR),
    setupKey: variables.SYNC_SETUP_KEY || undefined,
    setupKeyAlways: variables.SYNC_SETUP_KEY_ALWAYS === '1',
    backupHour: parseBackupHour(variables.SYNC_BACKUP_HOUR),
    backupKeep: parsePositiveInt(variables.SYNC_BACKUP_KEEP, 'SYNC_BACKUP_KEEP', DEFAULT_BACKUP_KEEP),
    historyDays: parsePositiveInt(variables.SYNC_HISTORY_DAYS, 'SYNC_HISTORY_DAYS', DEFAULT_HISTORY_DAYS),
    trustProxy: variables.SYNC_TRUST_PROXY === '1',
    minClientVersion: parseMinClientVersion(variables.SYNC_MIN_CLIENT_VERSION),
  });
}
