import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail } from '#core/server/errors/domain-error.mjs';

const LOG_LINES_SHOWN = 200;
const BACKUPS_SHOWN = 10;

// Fără home (dezvoltare, fără lansator), nu există fișier de jurnal de citit.
/** @param {string | undefined} home */
function recentLogLines(home) {
  if (!home) return [];
  const file = join(home, 'Jurnale', 'startica.log');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-LOG_LINES_SHOWN);
}

/**
 * @param {{
 *   version: string,
 *   home: string | undefined,
 *   database: string,
 *   backupDirectory: string,
 *   readSetting: (key: string) => string,
 *   backupService: { health: () => unknown, listBackups: () => { name: string }[] },
 *   allowShutdown: boolean,
 * }} dependencies
 */
export function createDiagnosticRoutes({
  version,
  home,
  database,
  backupDirectory,
  readSetting,
  backupService,
  allowShutdown,
}) {
  return [
    {
      method: 'GET',
      path: '/api/diagnostic',
      // Ca /api/shutdown: ruta există mereu, dar refuză cererea fără allowShutdown.
      handle: () => {
        if (!allowShutdown) fail('Operațiune inexistentă.', 404);
        return {
          version,
          node: process.version,
          platform: process.platform,
          home: home || '',
          database,
          backupDirectory,
          schemaVersion: Number(readSetting('schemaVersion')),
          health: backupService.health(),
          backups: backupService
            .listBackups()
            .slice(0, BACKUPS_SHOWN)
            .map(entry => entry.name),
          log: recentLogLines(home),
        };
      },
    },
  ];
}
