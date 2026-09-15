import { fail } from '#core/server/errors/domain-error.mjs';
import { validateState } from '#shared/domain/record-schema.mjs';
import { summary } from '#shared/domain/records-report.mjs';
import { readBackupSnapshotDetails } from './backup-snapshot.mjs';
import { assertUsableExternalFolder } from './external-backup-folder.mjs';

/** @typedef {import('../backup.types.mjs').BackupRoutesDependencies} BackupRoutesDependencies */

const RESTORE_CONFIRMATION = 'RESTAUREAZA';
const SETTINGS_AUDIT_ACTION = 'configurare backup';

// [] dacă snapshot-ul e o stare validă, altfel primul mesaj de eroare al validării.
function previewErrors(snapshot) {
  try {
    validateState(snapshot);
    return [];
  } catch (error) {
    return [/** @type {Error} */ (error).message];
  }
}

/** @param {BackupRoutesDependencies} dependencies */
export function createBackupRoutes({
  backupService,
  readSetting,
  writeSetting,
  auditTrail,
  runRevisionTransaction,
  replaceAllRecords,
  dataDirectory,
  backupDirectory,
}) {
  return [
    { method: 'GET', path: '/api/health', handle: () => backupService.health() },
    { method: 'GET', path: '/api/backups', handle: () => backupService.listBackups() },
    {
      method: 'GET',
      path: '/api/backup-preview',
      /** @param {{ url: URL }} request */
      handle: ({ url }) => {
        const { snapshot, notes } = readBackupSnapshotDetails(
          backupService.resolveBackupFile(url.searchParams.get('name')),
        );
        return { ...summary(snapshot), errors: previewErrors(snapshot), notes };
      },
    },
    {
      method: 'POST',
      path: '/api/backup',
      handle: () => {
        try {
          return { ok: true, ...backupService.backup(), health: backupService.health() };
        } catch (e) {
          // Backupul manual e acțiunea operatorului: eroarea generică nu i-ar spune ce să facă.
          console.error(/** @type {Error} */ (e).stack || e);
          return fail('Backupul nu a putut fi creat. Verifică folderul de backup și spațiul pe disc.', 500);
        }
      },
    },
    {
      method: 'POST',
      path: '/api/restore',
      /** @param {{ body: any }} request */
      handle: ({ body }) => {
        if (body.confirm !== RESTORE_CONFIRMATION) fail('Confirmă restaurarea.');
        const { snapshot } = readBackupSnapshotDetails(backupService.resolveBackupFile(body.name));
        const state = validateState(snapshot);
        return runRevisionTransaction(body, { action: 'restaurare', backupBefore: true }, () =>
          replaceAllRecords(state, 'restaurare'),
        );
      },
    },
    {
      method: 'POST',
      path: '/api/settings',
      /** @param {{ body: any }} request */
      handle: ({ body }) => {
        const folder = String(body.externalDir || '').trim();
        assertUsableExternalFolder(folder, [dataDirectory, backupDirectory]);
        const before = readSetting('externalDir');
        writeSetting('externalDir', folder);
        if (before !== folder) {
          writeSetting('lastExternal', '');
          writeSetting('externalError', '');
        }
        auditTrail.recordChange({
          action: SETTINGS_AUDIT_ACTION,
          recordType: null,
          recordId: null,
          before: { externalDir: before },
          after: { externalDir: folder },
        });
        return { ok: true, ...backupService.safeBackup('configurare'), health: backupService.health() };
      },
    },
  ];
}
