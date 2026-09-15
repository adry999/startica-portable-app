/** @typedef {import('../backup.types.mjs').BackupFileEntry} BackupFileEntry */
/** @typedef {Pick<BackupFileEntry, 'name' | 'modified'>} RetainableBackupFile */

// Ce se păstrează: ultimele 20 de copii, câte una pentru fiecare din ultimele
// 30 de zile și 12 luni cu backup, plus copiile dinaintea unei operațiuni
// ireversibile, care nu expiră.
/**
 * @param {RetainableBackupFile[]} files
 * @returns {Set<string>}
 */
export function selectBackupsToKeep(files) {
  const sorted = [...files].sort((a, b) => b.modified.localeCompare(a.modified));
  const keep = new Set(sorted.slice(0, 20).map(file => file.name)),
    days = new Set(),
    months = new Set();
  for (const file of sorted) {
    const day = file.modified.slice(0, 10),
      month = day.slice(0, 7);
    if (!days.has(day) && days.size < 30) {
      days.add(day);
      keep.add(file.name);
    }
    if (!months.has(month) && months.size < 12) {
      months.add(month);
      keep.add(file.name);
    }
    if (/inainte-|migrare/.test(file.name)) keep.add(file.name);
  }
  return keep;
}
