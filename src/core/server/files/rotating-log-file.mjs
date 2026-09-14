import { appendFileSync, existsSync, renameSync, statSync, unlinkSync } from 'node:fs';

const DEFAULT_MAX_BYTES = 1000000;

// O singură generație e suficientă pentru un jurnal local, fără complexitatea mai multor fișiere.
/** @param {{ file: string, maxBytes?: number }} options */
export function createRotatingLogFile({ file, maxBytes = DEFAULT_MAX_BYTES }) {
  const rotatedFile = file.replace(/\.log$/, '.1.log');

  function rotateIfNeeded() {
    if (!existsSync(file) || statSync(file).size < maxBytes) return;
    if (existsSync(rotatedFile)) unlinkSync(rotatedFile);
    renameSync(file, rotatedFile);
  }

  /**
   * @param {string} level
   * @param {string} message
   */
  function write(level, message) {
    // Jurnalul nu doboară serverul: disc plin sau fișier rotit ținut deschis de altcineva.
    try {
      rotateIfNeeded();
      appendFileSync(file, `${new Date().toISOString()} ${level} ${message}\n`);
    } catch {}
  }

  return { write };
}
