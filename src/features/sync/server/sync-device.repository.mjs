import { existsSync, readFileSync } from 'node:fs';
import { writeJsonFileAtomically } from '#core/server/files/json-file.mjs';

const DEVICE_FILE_VERSION = 1;

/** @param {unknown} value */
function looksLikeSyncDevice(value) {
  const candidate = /** @type {Partial<import('../sync.types.d.mts').SyncDeviceFile> | null} */ (value);
  return (
    !!candidate &&
    typeof candidate === 'object' &&
    candidate.version === DEVICE_FILE_VERSION &&
    typeof candidate.serverUrl === 'string' &&
    typeof candidate.deviceId === 'string' &&
    typeof candidate.deviceName === 'string' &&
    typeof candidate.token === 'string' &&
    typeof candidate.connectedAt === 'string'
  );
}

// Aceeași politică ca filiale.json (branch-registry.mjs): fișierul lipsă înseamnă
// „neconectat” (null), dar unul corupt oprește pornirea cu un mesaj clar — nu îl
// suprascriem în tăcere, ca să nu pierdem token-ul deja emis de server.
/**
 * @param {string} file
 * @returns {import('../sync.types.d.mts').SyncDeviceFile | null}
 */
export function readSyncDeviceFile(file) {
  if (!existsSync(file)) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Fișierul de dispozitiv (sync.json) este corupt: ${/** @type {Error} */ (error).message}`);
  }
  if (!looksLikeSyncDevice(parsed))
    throw new Error('Fișierul de dispozitiv (sync.json) este corupt: structură necunoscută.');
  return /** @type {import('../sync.types.d.mts').SyncDeviceFile} */ (parsed);
}

/**
 * @param {string} file
 * @param {Omit<import('../sync.types.d.mts').SyncDeviceFile, 'version'>} device
 */
export function writeSyncDeviceFile(file, device) {
  writeJsonFileAtomically(file, { version: DEVICE_FILE_VERSION, ...device });
}

/**
 * Identitatea de dispozitiv, per instalare (decizia 2 din plan): citită o singură
 * dată la pornirea procesului, într-un depozit mutabil pe care fiecare filială
 * (create-branch-context.mjs) îl întreabă la deschidere ca să decidă dacă
 * sincronizarea e activă. Conectarea/deconectarea (Faza 5) scriu prin `write`/`clear`.
 * @param {string} file
 */
export function createSyncDeviceRepository(file) {
  let device = readSyncDeviceFile(file);

  function read() {
    return device;
  }

  /** @param {Omit<import('../sync.types.d.mts').SyncDeviceFile, 'version'>} next */
  function write(next) {
    writeSyncDeviceFile(file, next);
    device = { version: DEVICE_FILE_VERSION, ...next };
  }

  // Faza 5 (disconnect) șterge și fișierul de pe disc; aici golim doar memoria,
  // ca isEnabled() să răspundă imediat „neconfigurat”, fără operațiuni de fișier.
  function clear() {
    device = null;
  }

  return { read, write, clear };
}
