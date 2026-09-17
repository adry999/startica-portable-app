import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * @param {string} file
 * @returns {unknown | null}
 */
export function readJsonFile(file) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Fișierul ${file} este corupt: ${/** @type {Error} */ (error).message}`);
    return null;
  }
}

// Scriere prin fișier temporar + redenumire: un proces întrerupt la mijlocul
// scrierii nu are cum să lase în urmă o configurare pe jumătate scrisă.
/**
 * @param {string} file
 * @param {unknown} value
 */
export function writeJsonFileAtomically(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file + '.tmp', JSON.stringify(value));
  renameSync(file + '.tmp', file);
}
