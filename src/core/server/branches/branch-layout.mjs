import { join } from 'node:path';
import { BRANCHES_DIR_NAME, dataLayout } from '#config/environment.mjs';
import { openDatabaseReadOnly } from '#core/server/database/sqlite-connection.mjs';

/** @typedef {{ dataDir: string, backupDir: string }} BranchDataLayout */

/**
 * Folderele de date/backup ale unei filiale: cele vechi pentru filiala
 * migrată (`folder === null`, decizia 4 din plan — nimic nu se mută), sau
 * `Filiale\<folder>\{Startica_Date,Startica_Backup}` pentru una nouă.
 * @param {{ home: string, legacy: BranchDataLayout, branch: { folder: string | null } }} params
 * @returns {BranchDataLayout}
 */
export function branchDirectories({ home, legacy, branch }) {
  if (branch.folder === null) return { dataDir: legacy.dataDir, backupDir: legacy.backupDir };
  const layout = dataLayout(join(home, BRANCHES_DIR_NAME, branch.folder));
  return { dataDir: layout.dataDir, backupDir: layout.backupDir };
}

/** @typedef {{ children: number, groups: number, lastLocal: string }} BranchRecordCounts */

// Deschidere read-only, ca la rezumatul Telegram: „N copii · N grupe” pentru o
// filială care nu e activă nu are voie să scrie nimic în baza ei.
/**
 * @param {string} dataDir
 * @returns {BranchRecordCounts}
 */
export function countBranchRecords(dataDir) {
  const opened = openDatabaseReadOnly({ dataDir });
  if (!opened) return { children: 0, groups: 0, lastLocal: '' };
  try {
    const rows = /** @type {{ kind: string, count: number }[]} */ (
      opened.db
        .prepare("SELECT kind, COUNT(*) AS count FROM records WHERE kind IN ('children','groups') GROUP BY kind")
        .all()
    );
    const counts = { children: 0, groups: 0 };
    for (const row of rows) counts[/** @type {'children' | 'groups'} */ (row.kind)] = row.count;
    const lastLocal = /** @type {{ value: string } | undefined} */ (
      opened.db.prepare("SELECT value FROM settings WHERE key='lastLocal'").get()
    );
    return { children: counts.children, groups: counts.groups, lastLocal: lastLocal?.value || '' };
  } finally {
    opened.db.close();
  }
}
