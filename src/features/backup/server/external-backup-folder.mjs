import { existsSync, statSync } from 'node:fs';
import { resolve, isAbsolute, relative } from 'node:path';
import { fail } from '#core/server/errors/domain-error.mjs';

// Folderul extern nu are voie să fie baza activă sau folderul de backupuri:
// altfel copiile s-ar suprascrie sau ar fi șterse de retenție.
/**
 * @param {string} folder
 * @param {string[]} reservedDirectories
 */
export function assertUsableExternalFolder(folder, reservedDirectories) {
  if (!folder) return;
  if (!isAbsolute(folder) || !existsSync(folder) || !statSync(folder).isDirectory())
    fail('Alege un folder existent, folosind calea completă.');
  const absolute = resolve(folder);
  for (const dir of reservedDirectories) {
    const inside = relative(resolve(dir), absolute);
    if (absolute === resolve(dir) || (!inside.startsWith('..') && !isAbsolute(inside)))
      fail('Alege un folder diferit de baza de date și backupurile locale.');
  }
}
