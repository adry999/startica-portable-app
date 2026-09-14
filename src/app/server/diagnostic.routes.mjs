import { existsSync, readFileSync } from 'node:fs';
import { fail } from '#core/server/errors/domain-error.mjs';

const LOG_LINES_SHOWN = 200;
const BACKUPS_SHOWN = 10;

// Fără logFile (dezvoltare, fără lansator), nu există jurnal de citit.
/** @param {string | undefined} logFile */
function recentLogLines(logFile) {
  if (!logFile || !existsSync(logFile)) return [];
  return readFileSync(logFile, 'utf8').split('\n').filter(Boolean).slice(-LOG_LINES_SHOWN);
}

/**
 * @param {{
 *   version: string,
 *   home: string | undefined,
 *   logFile: string | undefined,
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
  logFile,
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
          log: recentLogLines(logFile),
        };
      },
    },
  ];
}
