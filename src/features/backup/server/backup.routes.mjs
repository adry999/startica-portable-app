import { resolve } from 'node:path';
import { fail } from '#core/server/errors/domain-error.mjs';
import { validateState } from '#shared/domain/record-schema.mjs';
import { summary } from '#shared/domain/records-report.mjs';
import { readBackupSnapshotDetails } from './backup-snapshot.mjs';
import { assertUsableExternalFolder, normalizeExternalFolder } from './external-backup-folder.mjs';

/** @typedef {import('../backup.types.mjs').BackupRoutesDependencies} BackupRoutesDependencies */

const RESTORE_CONFIRMATION = 'RESTAUREAZA';
const SETTINGS_AUDIT_ACTION = 'configurare backup';
const RESTORE_AUDIT_ACTION = 'restaurare';
const EXTERNAL_READ_FAILURE =
  'Copia nu a putut fi citită. Dacă e în Google Drive, așteaptă să fie descărcată (bifa verde) și încearcă din nou.';
// 42d, decizia 9 din plan: un backup vechi `.db` conține o singură filială — avertisment
// clar în previzualizare, nu doar o restaurare tăcut incompletă.
const LEGACY_SINGLE_BRANCH_NOTE = 'Acest backup conține o singură filială; Comun și celelalte filiale nu se schimbă.';

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
  backupDirectory,
  forbiddenFolders,
  // 42d: ambele opționale — un context de test izolat de filială (create-branch-context.test.mjs,
  // dacă există vreunul) poate construi rutele fără ele; fără fullBackupService, `/api/backup`
  // rămâne pe fluxul legacy per-filială, iar `/api/backup-preview`/`/api/restore` nu încearcă
  // niciodată să detecteze o arhivă (isArchive nu există ca să-l apeleze).
  fullBackupService,
  restoreFullBackup,
}) {
  // dir gol sau absent înseamnă lista locală.
  function resolveRestoreFile({ name, dir }) {
    return dir ? backupService.resolveExternalBackupFile(dir, name) : backupService.resolveBackupFile(name);
  }

  // Un fișier „online-only” din Drive se descarcă sincron la deschidere; eroarea
  // de sistem care rezultă offline nu e interpretabilă de operator.
  function readRestoreSnapshot(file, isExternal) {
    try {
      return readBackupSnapshotDetails(file);
    } catch (error) {
      const failure = /** @type {Error & { status?: number }} */ (error);
      if (!isExternal || typeof failure.status === 'number') throw failure;
      console.error(failure.stack || failure);
      return fail(EXTERNAL_READ_FAILURE);
    }
  }

  function configureExternalDir(folder) {
    const before = readSetting('externalDir');
    writeSetting('externalDir', folder);
    if (normalizeExternalFolder(before) !== folder) {
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
  }

  return [
    { method: 'GET', path: '/api/health', handle: () => backupService.health() },
    { method: 'GET', path: '/api/backups', handle: () => backupService.listBackups() },
    {
      method: 'GET',
      path: '/api/external-backups',
      /** @param {{ url: URL }} request */
      handle: ({ url }) => {
        const dir = (url.searchParams.get('dir') || '').trim();
        return { folder: resolve(dir), backups: backupService.listExternalBackups(dir) };
      },
    },
    {
      method: 'GET',
      path: '/api/backup-preview',
      /** @param {{ url: URL }} request */
      handle: ({ url }) => {
        const dir = (url.searchParams.get('dir') || '').trim();
        const file = resolveRestoreFile({ name: url.searchParams.get('name'), dir });
        // 42d, decizia 9 din plan: încearcă arhiva completă întâi — un `.startica-backup`
        // e un ZIP valid, un `.db` legacy nu e niciodată, deci proba nu are ambiguitate.
        if (fullBackupService?.isArchive(file)) {
          const { summary: archiveSummary } = fullBackupService.previewArchive(file);
          return { ...archiveSummary, errors: [], notes: [] };
        }
        const { snapshot, notes } = readRestoreSnapshot(file, !!dir);
        return { ...summary(snapshot), errors: previewErrors(snapshot), notes: [...notes, LEGACY_SINGLE_BRANCH_NOTE] };
      },
    },
    {
      method: 'POST',
      path: '/api/backup',
      handle: () => {
        try {
          // 42d: backupul manual devine arhiva completă (toate bazele), nu doar filiala
          // activă — decizia 6 din plan. Backupul automat rămâne per-filială, neschimbat.
          if (fullBackupService) return { ok: true, ...fullBackupService.backup('manual'), health: backupService.health() };
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
        const dir = normalizeExternalFolder(body.dir);
        const { name } = body;
        const file = resolveRestoreFile({ name, dir });

        // 42d: o arhivă completă nu trece prin runRevisionTransaction/replaceAllRecords — e o
        // înlocuire de FIȘIERE pe mai multe baze, nu de rânduri pe cea deschisă acum (vezi
        // decizia 8 din plan). restoreFullBackup() își face singur backupul de siguranță,
        // validarea arhivei și redeschiderea conexiunilor; un eșec aici nu atinge nimic pe disc.
        if (fullBackupService?.isArchive(file)) {
          if (!restoreFullBackup) fail('Restaurarea unei arhive complete nu e disponibilă în acest context.', 500);
          restoreFullBackup(file);
          return { ok: true, warning: '' };
        }

        const { snapshot } = readRestoreSnapshot(file, !!dir);
        const state = validateState(snapshot);
        const folder = dir || backupDirectory;

        const result = runRevisionTransaction(body, { action: RESTORE_AUDIT_ACTION, backupBefore: true }, () => {
          auditTrail.recordChange({
            action: RESTORE_AUDIT_ACTION,
            recordType: null,
            recordId: null,
            before: null,
            after: { sursa: dir ? 'extern' : 'local', folder, name },
          });
          replaceAllRecords(state, RESTORE_AUDIT_ACTION);
        });

        if (!dir) return result;

        const restoreWarning = /** @type {{ warning?: string }} */ (result).warning || '';
        const configured = readSetting('externalDir');
        if (!configured) {
          // Setarea se face DUPĂ tranzacție: înainte, ar trimite în Drive copia goală dinaintea restaurării.
          configureExternalDir(folder);
          const configureResult = backupService.safeBackup('configurare');
          const warning =
            restoreWarning + (configureResult.warning ? (restoreWarning ? ' ' : '') + configureResult.warning : '');
          return { ...result, warning, health: backupService.health() };
        }
        if (normalizeExternalFolder(configured) !== folder)
          return {
            ...result,
            warning:
              restoreWarning +
              (restoreWarning ? ' ' : '') +
              'Folderul extern configurat rămâne ' +
              configured +
              '; schimbă-l în Setări dacă vrei copiile în folderul folosit la restaurare.',
          };
        return result;
      },
    },
    {
      method: 'POST',
      path: '/api/settings',
      /** @param {{ body: any }} request */
      handle: ({ body }) => {
        const folder = normalizeExternalFolder(body.externalDir);
        assertUsableExternalFolder(folder, forbiddenFolders());
        configureExternalDir(folder);
        return { ok: true, ...backupService.safeBackup('configurare'), health: backupService.health() };
      },
    },
  ];
}
