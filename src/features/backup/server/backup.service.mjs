import { existsSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail } from '#core/server/errors/domain-error.mjs';
import { sha256Hex } from '#core/server/persistence/content-digest.mjs';
import { sqlStringLiteral } from '#core/server/database/sql-string-literal.mjs';
import { fileTimestamp } from '#core/server/files/file-timestamp.mjs';
import { removeFileIfPresent } from '#core/server/files/remove-file-if-present.mjs';
import { selectBackupsToKeep } from '../domain/backup-retention.mjs';
import { readBackupSnapshot } from './backup-snapshot.mjs';

/** @typedef {import('../backup.types.mjs').BackupFileEntry} BackupFileEntry */
/** @typedef {import('../backup.types.mjs').BackupHealth} BackupHealth */
/** @typedef {import('../backup.types.mjs').BackupResult} BackupResult */
/** @typedef {import('../backup.types.mjs').SafeBackupResult} SafeBackupResult */
/** @typedef {import('../backup.types.mjs').BackupServiceDependencies} BackupServiceDependencies */

const BACKUP_NAME = /^startica_[A-Za-z0-9_.-]+\.db$/;
const TEMPORARY_NAME = /^startica_[A-Za-z0-9_.-]+\.db\.tmp$/;
// Un .tmp mai nou decât atât poate aparține unui backup aflat în curs.
const TEMPORARY_GRACE_MS = 3600000;

/** @returns {BackupFileEntry[]} */
function fileList(dir) {
  return readdirSync(dir)
    .filter(name => BACKUP_NAME.test(name))
    .map(name => ({ name, modified: statSync(join(dir, name)).mtime.toISOString() }))
    .sort((a, b) => b.modified.localeCompare(a.modified));
}

// Copiile dinaintea unei operațiuni ireversibile nu expiră niciodată (vezi
// selectBackupsToKeep) — nimeni nu le șterge automat, deci utilizatorul trebuie
// să poată vedea cât cresc, ca să decidă singur când face curățenie manuală.
function permanentBackupsSummary(dir) {
  try {
    const files = readdirSync(dir).filter(name => BACKUP_NAME.test(name) && /inainte-|migrare/.test(name));
    return { count: files.length, bytes: files.reduce((sum, name) => sum + statSync(join(dir, name)).size, 0) };
  } catch {
    return { count: 0, bytes: 0 };
  }
}

// Un backup întrerupt (cădere de curent, disc plin) lasă în urmă un fișier
// .db.tmp de dimensiunea bazei. fileList() nu îl vede, deci retenția nu îl
// atinge niciodată.
function pruneTemporary(dir) {
  const cutoff = Date.now() - TEMPORARY_GRACE_MS;
  for (const name of readdirSync(dir)) {
    if (!TEMPORARY_NAME.test(name)) continue;
    const file = join(dir, name);
    try {
      if (statSync(file).mtimeMs < cutoff) unlinkSync(file);
    } catch {}
  }
}

/** @param {BackupServiceDependencies} dependencies */
export function createBackupService({
  database,
  databaseFile,
  backupDirectory,
  readSetting,
  writeSetting,
  autoBackupIntervalMs,
}) {
  let lastBackupAt = 0,
    scheduled = null;

  function prune() {
    const files = fileList(backupDirectory),
      keep = selectBackupsToKeep(files);
    for (const file of files) if (!keep.has(file.name)) unlinkSync(join(backupDirectory, file.name));
    pruneTemporary(backupDirectory);
  }

  function cancelScheduledBackup() {
    if (!scheduled) return;
    clearTimeout(scheduled);
    scheduled = null;
  }

  // Copia amânată. Fără ea, o singură modificare urmată de inactivitate nu ar
  // produce nicio copie până la închiderea aplicației: rărirea ar deveni
  // absență. Rulează în afara cererii HTTP, deci nu încetinește salvarea.
  // unref(): un backup în așteptare nu ține procesul pornit.
  function scheduleBackup() {
    if (scheduled || !autoBackupIntervalMs) return;
    scheduled = setTimeout(() => {
      scheduled = null;
      safeBackup('automat');
    }, autoBackupIntervalMs);
    scheduled.unref?.();
  }

  function copyExternally(name, file) {
    const external = readSetting('externalDir');
    if (!external) return '';
    const copy = join(external, name) + '.tmp';
    let warning = '';
    try {
      if (!existsSync(external) || !statSync(external).isDirectory()) fail('Folderul extern nu este disponibil.');
      copyFileSync(file, copy);
      // sha256Hex() e tipat pentru text, dar hash-uiește corect și conținutul binar al bazei.
      if (sha256Hex(/** @type {any} */ (readFileSync(file))) !== sha256Hex(/** @type {any} */ (readFileSync(copy))))
        fail('Copia externă diferă de original.');
      readBackupSnapshot(copy);
      renameSync(copy, join(external, name));
      writeSetting('lastExternal', new Date().toISOString());
      writeSetting('externalError', '');
    } catch (e) {
      const failure = /** @type {Error} */ (e);
      removeFileIfPresent(copy);
      warning = 'Backup local creat; copia externă a eșuat: ' + failure.message;
      writeSetting('externalError', failure.message);
    }
    try {
      pruneTemporary(external);
    } catch {}
    return warning;
  }

  // Copie verificată: VACUUM INTO într-un .tmp, deschidere și verificare a
  // integrității, abia apoi redenumire. Un fișier cu nume final este întotdeauna
  // o copie validă.
  /**
   * @param {string} [reason]
   * @returns {BackupResult}
   */
  function backup(reason = 'manual') {
    const name = `startica_${fileTimestamp()}_${reason}_${randomUUID().slice(0, 8)}.db`,
      file = join(backupDirectory, name),
      temp = file + '.tmp';
    try {
      database.exec(`VACUUM INTO ${sqlStringLiteral(temp)}`);
      readBackupSnapshot(temp);
      renameSync(temp, file);
    } catch (e) {
      removeFileIfPresent(temp);
      throw e;
    }
    writeSetting('lastLocal', new Date().toISOString());
    writeSetting('localError', '');
    // Orice copie reușită repornește ceasul și anulează copia programată,
    // indiferent de motiv: pornire, manual sau dinaintea unui import.
    lastBackupAt = Date.now();
    cancelScheduledBackup();
    let warning = copyExternally(name, file);
    try {
      prune();
    } catch (e) {
      warning += ' Curățarea backupurilor vechi a eșuat: ' + /** @type {Error} */ (e).message;
    }
    return { file, name, warning };
  }

  /**
   * @param {string} [reason]
   * @returns {SafeBackupResult}
   */
  function safeBackup(reason) {
    try {
      return backup(reason);
    } catch (e) {
      const failure = /** @type {Error} */ (e);
      writeSetting('localError', failure.message);
      return { warning: 'Datele sunt salvate, dar backupul local a eșuat: ' + failure.message };
    }
  }

  // Backupul de după o salvare obișnuită. Copia integrală a bazei nu are ce
  // căuta pe calea fiecărei cereri: datele sunt durabile la COMMIT, copia
  // servește la recuperare. O eroare anterioară se reîncearcă imediat, altfel
  // utilizatorul ar afla că backupul nu funcționează abia după expirarea
  // intervalului.
  /** @returns {SafeBackupResult} */
  function autoBackup() {
    const retrying = !!(readSetting('localError') || readSetting('externalError'));
    if (!retrying && Date.now() - lastBackupAt < autoBackupIntervalMs) {
      scheduleBackup();
      return { warning: '', skipped: true };
    }
    return safeBackup('automat');
  }

  // Eroarea externă memorată se actualizează doar când rulează un backup. Cu
  // backupul automat rărit, dispariția folderului (stick scos, Drive
  // deconectat) ar rămâne nesemnalată până la următoarea copie. Verificarea de
  // mai jos costă un stat() și rulează la fiecare interogare de stare.
  function externalFailure() {
    const stored = readSetting('externalError');
    if (stored) return stored;
    const dir = readSetting('externalDir');
    if (!dir) return '';
    try {
      return existsSync(dir) && statSync(dir).isDirectory() ? '' : 'Folderul extern nu este disponibil.';
    } catch (e) {
      return /** @type {Error} */ (e).message;
    }
  }

  /** @returns {BackupHealth} */
  function health() {
    return {
      ok: true,
      database: databaseFile,
      backup: backupDirectory,
      externalDir: readSetting('externalDir'),
      lastLocal: readSetting('lastLocal') || fileList(backupDirectory)[0]?.modified || '',
      lastExternal: readSetting('lastExternal'),
      localError: readSetting('localError'),
      externalError: externalFailure(),
      cloudVerified: false,
      permanentBackups: permanentBackupsSummary(backupDirectory),
    };
  }

  // Numele vine de la client: trebuie să fie un nume simplu de fișier din
  // folderul de backup, niciodată o cale.
  /**
   * @param {unknown} name
   * @returns {string}
   */
  function resolveBackupFile(name) {
    if (typeof name !== 'string' || basename(name) !== name || !BACKUP_NAME.test(name)) fail('Nume de backup invalid.');
    const file = join(backupDirectory, name);
    if (!existsSync(file)) fail('Backup inexistent.');
    return file;
  }

  return {
    backup,
    safeBackup,
    autoBackup,
    health,
    listBackups: () => fileList(backupDirectory),
    resolveBackupFile,
    cancelScheduledBackup,
  };
}
