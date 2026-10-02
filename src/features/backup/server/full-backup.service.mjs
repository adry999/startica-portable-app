import {
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  mkdtempSync,
  statSync,
  unlinkSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fail } from '#core/server/errors/domain-error.mjs';
import { sha256Hex } from '#core/server/persistence/content-digest.mjs';
import { sqlStringLiteral } from '#core/server/database/sql-string-literal.mjs';
import { fileTimestamp } from '#core/server/files/file-timestamp.mjs';
import { removeFileIfPresent } from '#core/server/files/remove-file-if-present.mjs';
import { createZipArchive, readZipArchive } from '#core/server/files/zip-archive.mjs';
import { openDatabaseReadOnly } from '#core/server/database/sqlite-connection.mjs';
import { branchDirectories } from '#core/server/branches/branch-layout.mjs';
import { selectBackupsToKeep } from '../domain/backup-retention.mjs';
import { summarizeDatabaseContents } from './database-contents.mjs';

/** @typedef {import('#core/server/branches/branch-registry.mjs').BranchEntry} BranchEntry */
/** @typedef {{ id: string, name: string, kind: 'branch' | 'common', file: string, sha256: string, counts: Record<string, number> }} ManifestDatabaseEntry */
/** @typedef {{ version: 1, appVersion: string, activeBranchId: string, createdAt: string, databases: ManifestDatabaseEntry[] }} BackupManifest */

export const ARCHIVE_EXTENSION = '.startica-backup';
const COMMON_ENTRY_ID = 'common';
const MANIFEST_FILE = 'manifest.json';

// „1.10.0” > „1.9.0” — compară numeric segment cu segment, nu ca text (altfel
// „1.10.0” < „1.9.0” lexicografic). O versiune lipsă sau nerecognoscută (arhivă
// foarte veche, dinainte de acest câmp) nu blochează niciodată restaurarea.
/**
 * @param {string} a
 * @param {string} b
 * @returns {number} negativ dacă a < b, 0 dacă egale, pozitiv dacă a > b
 */
function compareVersions(a, b) {
  const partsA = String(a).split('.').map(Number);
  const partsB = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * @param {Record<string, number>} actual
 * @param {Record<string, number>} expected
 * @returns {boolean}
 */
function countsMatch(actual, expected) {
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  for (const key of keys) if ((actual[key] || 0) !== (expected[key] || 0)) return false;
  return true;
}

// Nume reale produse de acest serviciu + cele vechi (o singură bază, vezi backup.service.mjs) —
// retenția și lista afișată în UI trebuie să le vadă pe amândouă (decizia 9 din plan).
const ARCHIVE_NAME = /^startica_[\p{L}\p{N}_. -]+\.startica-backup$/u;
const TEMPORARY_ARCHIVE_NAME = /^startica_[\p{L}\p{N}_. -]+\.startica-backup\.tmp$/u;

/**
 * @param {string} reason
 * @returns {string}
 */
function normalizeReason(reason) {
  return reason
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');
}

/**
 * @param {string} file
 * @returns {string}
 */
function sha256OfFile(file) {
  return sha256Hex(/** @type {any} */ (readFileSync(file)));
}

// O copie verificată a UNEI baze (comună sau de filială): VACUUM INTO într-un .tmp,
// verificare de integritate, redenumire — la fel ca backup.service.mjs, dar fără
// readBackupSnapshot() (specific formei de filială — ar arunca toate kind-urile unei
// baze comune ca „necunoscute”, vezi plan decizia 3/8).
/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} destFile
 */
function vacuumIntoVerified(db, destFile) {
  const temp = destFile + '.tmp';
  try {
    db.exec(`VACUUM INTO ${sqlStringLiteral(temp)}`);
    const check = new DatabaseSync(temp, { readOnly: true });
    try {
      const result = /** @type {{ integrity_check: string }} */ (check.prepare('PRAGMA integrity_check').get());
      if (result.integrity_check !== 'ok') fail('Copia bazei e coruptă.');
    } finally {
      check.close();
    }
    renameSync(temp, destFile);
  } catch (error) {
    removeFileIfPresent(temp);
    throw error;
  }
}

/**
 * @param {string} dir
 * @returns {{ name: string, modified: string, bytes: number }[]}
 */
function fileList(dir) {
  return readdirSync(dir)
    .filter(name => ARCHIVE_NAME.test(name))
    .map(name => {
      const stats = statSync(join(dir, name));
      return { name, modified: stats.mtime.toISOString(), bytes: stats.size };
    })
    .sort((a, b) => b.modified.localeCompare(a.modified));
}

/**
 * @param {string} dir
 */
function pruneTemporary(dir) {
  const cutoff = Date.now() - 3600000;
  for (const name of readdirSync(dir)) {
    if (!TEMPORARY_ARCHIVE_NAME.test(name)) continue;
    const file = join(dir, name);
    try {
      if (statSync(file).mtimeMs < cutoff) unlinkSync(file);
    } catch (error) {
      console.warn(`Arhiva temporară ${file} nu a putut fi curățată: ${/** @type {Error} */ (error).message}`);
    }
  }
}

/**
 * @typedef {{
 *   registry: { list: () => BranchEntry[] },
 *   home: string,
 *   legacy: { dataDir: string, backupDir: string },
 *   activeBranch: () => { branch: BranchEntry, db: import('node:sqlite').DatabaseSync },
 *   common: () => { db: import('node:sqlite').DatabaseSync },
 *   backupDirectory: () => string,
 *   readSetting: (key: string) => string,
 *   writeSetting: (key: string, value: string) => void,
 *   appVersion: string,
 * }} FullBackupServiceDependencies
 */

/** @param {FullBackupServiceDependencies} dependencies */
export function createFullBackupService({
  registry,
  home,
  legacy,
  activeBranch,
  common,
  backupDirectory,
  readSetting,
  writeSetting,
  appVersion,
}) {
  // Copiază arhiva în folderul extern, cu aceeași verificare prin hash ca la o bază
  // singulară (backup.service.mjs copyExternally) — dar „deschiderea de verificare” aici
  // e readZipArchive(), nu readBackupSnapshot() (arhiva nu e o bază SQLite).
  function copyExternally(name, file) {
    const external = readSetting('externalDir');
    if (!external) return '';
    const copy = join(external, name) + '.tmp';
    let warning = '';
    try {
      if (!existsSync(external) || !statSync(external).isDirectory()) fail('Folderul extern nu este disponibil.');
      copyFileSync(file, copy);
      if (sha256OfFile(file) !== sha256OfFile(copy)) fail('Copia externă diferă de original.');
      readZipArchive(readFileSync(copy));
      renameSync(copy, join(external, name));
      writeSetting('lastExternal', new Date().toISOString());
      writeSetting('externalError', '');
      try {
        const files = fileList(external),
          keep = selectBackupsToKeep(files);
        for (const file of files) if (!keep.has(file.name)) unlinkSync(join(external, file.name));
      } catch (e) {
        warning += ' Curățarea copiilor externe a eșuat: ' + /** @type {Error} */ (e).message;
      }
    } catch (e) {
      const failure = /** @type {Error} */ (e);
      removeFileIfPresent(copy);
      warning = 'Backup local creat; copia externă a eșuat: ' + failure.message;
      writeSetting('externalError', failure.message);
    }
    try {
      pruneTemporary(external);
    } catch (error) {
      console.warn(`Curățarea folderului extern ${external} a eșuat: ${/** @type {Error} */ (error).message}`);
    }
    return warning.trim();
  }

  function prune() {
    const dir = backupDirectory();
    const files = fileList(dir),
      keep = selectBackupsToKeep(files);
    for (const file of files) if (!keep.has(file.name)) unlinkSync(join(dir, file.name));
    pruneTemporary(dir);
  }

  /**
   * Construiește arhiva (fără să o scrie încă): o copie verificată per bază (comună +
   * fiecare filială din registru, activă sau nu — filialele fără bază creată încă pe disc
   * sunt omise, n-au ce conține), manifestul cu numărătoarea pe tipuri derivată din
   * database-contents.mjs, totul într-un folder de lucru temporar lângă backupDirectory().
   * @param {string} stagingDir
   * @returns {{ entries: { name: string, data: Buffer }[], manifest: BackupManifest }}
   */
  function buildArchiveContents(stagingDir) {
    /** @type {ManifestDatabaseEntry[]} */
    const databases = [];
    /** @type {{ name: string, data: Buffer }[]} */
    const entries = [];

    /**
     * @param {{ id: string, name: string, kind: 'branch' | 'common', db?: import('node:sqlite').DatabaseSync, dataDir?: string }} target
     */
    function addDatabase({ id, name, kind, db, dataDir }) {
      const fileName = kind === 'common' ? 'common.db' : `branch-${id}.db`;
      const dest = join(stagingDir, `${randomUUID()}.db`);
      if (db) {
        vacuumIntoVerified(db, dest);
      } else {
        const opened = openDatabaseReadOnly({ dataDir });
        if (!opened) return; // filială fără nicio bază creată pe disc încă — nimic de copiat.
        try {
          vacuumIntoVerified(opened.db, dest);
        } finally {
          opened.db.close();
        }
      }
      const data = readFileSync(dest);
      databases.push({
        id,
        name,
        kind,
        file: fileName,
        sha256: sha256OfFile(dest),
        counts: summarizeDatabaseContents(dest),
      });
      entries.push({ name: fileName, data });
      removeFileIfPresent(dest);
    }

    addDatabase({ id: COMMON_ENTRY_ID, name: 'Comun', kind: 'common', db: common().db });

    const active = activeBranch();
    for (const branch of registry.list()) {
      if (branch.id === active.branch.id) {
        addDatabase({ id: branch.id, name: branch.name, kind: 'branch', db: active.db });
      } else {
        const dirs = branchDirectories({ home, legacy, branch });
        addDatabase({ id: branch.id, name: branch.name, kind: 'branch', dataDir: dirs.dataDir });
      }
    }

    /** @type {BackupManifest} */
    const manifest = {
      version: 1,
      appVersion,
      activeBranchId: active.branch.id,
      createdAt: new Date().toISOString(),
      databases,
    };
    entries.unshift({ name: MANIFEST_FILE, data: Buffer.from(JSON.stringify(manifest, null, 2)) });
    return { entries, manifest };
  }

  /**
   * @param {string} [reason]
   * @returns {{ file: string, name: string, manifest: BackupManifest, warning: string }}
   */
  function backup(reason = 'manual') {
    const dir = backupDirectory();
    const name = `startica_${fileTimestamp()}_${normalizeReason(reason)}_${randomUUID().slice(0, 8)}${ARCHIVE_EXTENSION}`,
      file = join(dir, name),
      temp = file + '.tmp';
    const { entries, manifest } = buildArchiveContents(dir);
    try {
      const archive = createZipArchive(entries);
      writeFileSync(temp, archive);
      readZipArchive(readFileSync(temp));
      renameSync(temp, file);
    } catch (error) {
      removeFileIfPresent(temp);
      throw error;
    }
    writeSetting('lastLocal', new Date().toISOString());
    writeSetting('localError', '');
    let warning = copyExternally(name, file);
    try {
      prune();
    } catch (e) {
      warning += ' Curățarea backupurilor vechi a eșuat: ' + /** @type {Error} */ (e).message;
    }
    return { file, name, manifest, warning: warning.trim() };
  }

  /**
   * @param {string} [reason]
   */
  function safeBackup(reason) {
    try {
      return backup(reason);
    } catch (e) {
      const failure = /** @type {Error} */ (e);
      writeSetting('localError', failure.message);
      return { warning: 'Backupul complet a eșuat: ' + failure.message };
    }
  }

  /**
   * @param {unknown} name
   * @returns {string}
   */
  function resolveArchiveFile(name) {
    if (typeof name !== 'string' || basename(name) !== name || !ARCHIVE_NAME.test(name))
      fail('Nume de backup invalid.');
    const file = join(backupDirectory(), name);
    if (!existsSync(file)) fail('Backup inexistent.');
    return file;
  }

  /**
   * Citește manifestul unei arhive fără să schimbe nimic pe disc — pentru previzualizarea
   * restaurării (ce baze conține, cu numărătoarea lor).
   * @param {string} file
   * @returns {BackupManifest}
   */
  function readArchiveManifest(file) {
    const entries = readZipArchive(readFileSync(file));
    const manifestEntry = entries.find(entry => entry.name === MANIFEST_FILE);
    if (!manifestEntry) fail('Arhiva nu are manifest.json — backup incomplet sau corupt.');
    return JSON.parse(manifestEntry.data.toString('utf8'));
  }

  /**
   * Validează o arhivă complet, fără să schimbe nimic pe disc (42d: previzualizare și
   * restaurare trec amândouă prin aceeași verificare, nu doar prin readArchiveManifest).
   * Aruncă clar pe: nume/manifest lipsă (readArchiveManifest), versiune de aplicație mai
   * nouă decât cea instalată, bază lipsă din arhivă, bază coruptă (integrity_check) sau a
   * cărei numărătoare nu corespunde manifestului (arhivă trunchiată/alterată). Arhiva de pe
   * disc nu se atinge niciodată aici — un eșec păstrează fișierul exact cum era.
   * @param {string} file
   * @returns {{ manifest: BackupManifest, databaseFiles: Map<string, Buffer> }}
   */
  function validateArchive(file) {
    const entries = readZipArchive(readFileSync(file));
    const manifestEntry = entries.find(entry => entry.name === MANIFEST_FILE);
    if (!manifestEntry) fail('Arhiva nu are manifest.json — backup incomplet sau corupt.');
    /** @type {BackupManifest} */
    const manifest = JSON.parse(manifestEntry.data.toString('utf8'));
    if (manifest.appVersion && compareVersions(manifest.appVersion, appVersion) > 0)
      fail(
        `Arhiva a fost creată cu Startica ${manifest.appVersion}, mai nouă decât versiunea instalată (${appVersion}). Actualizează aplicația înainte de a restaura.`,
      );

    const stagingDir = mkdtempSync(join(backupDirectory(), '.restaurare-'));
    /** @type {Map<string, Buffer>} */
    const databaseFiles = new Map();
    try {
      for (const entry of manifest.databases) {
        const zipEntry = entries.find(candidate => candidate.name === entry.file);
        if (!zipEntry) fail(`Arhiva nu conține ${entry.file} (${entry.name}) — backup incomplet sau corupt.`);
        const staged = join(stagingDir, entry.file);
        writeFileSync(staged, zipEntry.data);
        const check = new DatabaseSync(staged, { readOnly: true });
        let integrityOk;
        try {
          integrityOk =
            /** @type {{ integrity_check: string }} */ (check.prepare('PRAGMA integrity_check').get())
              .integrity_check === 'ok';
        } finally {
          check.close();
        }
        if (!integrityOk) fail(`Baza „${entry.name}” din arhivă e coruptă.`);
        if (!countsMatch(summarizeDatabaseContents(staged), entry.counts))
          fail(
            `Numărătoarea bazei „${entry.name}” nu corespunde manifestului arhivei — arhiva ar putea fi coruptă sau incompletă.`,
          );
        databaseFiles.set(entry.id, zipEntry.data);
      }
    } finally {
      rmSync(stagingDir, { recursive: true, force: true });
    }
    return { manifest, databaseFiles };
  }

  /**
   * Restaurare dintr-o arhivă validă: `apply` primește manifestul + conținutul fiecărei
   * baze (indexat după id-ul din manifest) și face singur înlocuirea de fișiere și
   * redeschiderea conexiunilor — `full-backup.service.mjs` nu ține nicio conexiune
   * `common`/filială vie, deci nu are cum să le închidă/redeschidă el însuși (decizia 8
   * din plan: asta rămâne treaba `create-application.mjs`). Validarea completă rulează
   * ÎNAINTE de orice apel la `apply`, deci `apply` nu mai poate eșua din cauza arhivei.
   * @param {string} file
   * @param {{ apply: (args: { manifest: BackupManifest, databaseFiles: Map<string, Buffer> }) => void }} options
   */
  function restore(file, { apply }) {
    const { manifest, databaseFiles } = validateArchive(file);
    apply({ manifest, databaseFiles });
  }

  return {
    backup,
    safeBackup,
    listBackups: () => fileList(backupDirectory()),
    resolveArchiveFile,
    readArchiveManifest,
    validateArchive,
    restore,
    isArchive: file => {
      try {
        readZipArchive(readFileSync(file));
        return true;
      } catch {
        return false;
      }
    },
  };
}
