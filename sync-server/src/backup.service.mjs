import { mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const CHECK_INTERVAL_MS = 10 * 60 * 1000;

/** @param {string} value */
function escapeSqliteLiteral(value) {
  return value.replace(/'/g, "''");
}

/** @param {string} backupsDir @param {number} keep */
function pruneOldBackups(backupsDir, keep) {
  const files = readdirSync(backupsDir)
    .filter(name => name.endsWith('.db'))
    .map(name => ({ path: join(backupsDir, name), mtime: statSync(join(backupsDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const file of files.slice(keep)) unlinkSync(file.path);
}

/**
 * O singură rulare a copiei de siguranță zilnice: `VACUUM INTO` un fișier nou, păstrează
 * cele mai recente `keep` fișiere, șterge din `changes` istoricul mai vechi de `historyDays`
 * (capul `records` nu e afectat) și reține momentul în `meta.lastBackupAt`.
 * @param {{ database: import('node:sqlite').DatabaseSync, dataDir: string, keep: number, historyDays: number, now: Date }} input
 */
export function runBackupCycle({ database, dataDir, keep, historyDays, now }) {
  const backupsDir = join(dataDir, 'backups');
  mkdirSync(backupsDir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const target = join(backupsDir, `sync_${stamp}.db`);
  const temp = `${target}.tmp`;
  database.exec(`VACUUM INTO '${escapeSqliteLiteral(temp)}'`);
  renameSync(temp, target);
  pruneOldBackups(backupsDir, keep);
  const cutoff = new Date(now.getTime() - historyDays * 24 * 60 * 60 * 1000).toISOString();
  const oldestDeleted = /** @type {{ maxSeq: number | null }} */ (
    database.prepare('SELECT MAX(seq) AS maxSeq FROM changes WHERE received_at < ?').get(cutoff)
  ).maxSeq;
  database.prepare('DELETE FROM changes WHERE received_at < ?').run(cutoff);
  // changes_floor_seq: totul până la această valoare a fost șters definitiv — pull()
  // dă 410 (resincronizare din snapshot) unui cursor mai vechi decât ea.
  if (oldestDeleted !== null) {
    const currentFloor = Number(readMeta(database, 'changes_floor_seq') ?? 0);
    setMeta(database, 'changes_floor_seq', String(Math.max(currentFloor, oldestDeleted)));
  }
  const lastBackupAt = now.toISOString();
  setMeta(database, 'lastBackupAt', lastBackupAt);
  return { backupFile: target, lastBackupAt };
}

/** @param {import('node:sqlite').DatabaseSync} database @param {string} key @param {string} value */
function setMeta(database, key, value) {
  database
    .prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, value);
}

/** @param {import('node:sqlite').DatabaseSync} database @param {string} key */
export function readMeta(database, key) {
  const row = database.prepare('SELECT value FROM meta WHERE key=?').get(key);
  return row ? /** @type {string} */ (row.value) : undefined;
}

/**
 * Verifică o dată pe zi, la `hour`, dacă backupul de azi a rulat deja; e sigur să fie
 * apelată des (`checkOnce`, la fiecare 10 minute) — nu rulează decât o dată pe zi.
 * @param {{ database: import('node:sqlite').DatabaseSync, dataDir: string, hour: number, keep: number, historyDays: number, now?: () => Date, intervalMs?: number }} input
 */
export function scheduleDailyBackup({
  database,
  dataDir,
  hour,
  keep,
  historyDays,
  now = () => new Date(),
  intervalMs = CHECK_INTERVAL_MS,
}) {
  let lastRunDate = /** @type {string | null} */ (null);

  function checkOnce() {
    const currentNow = now();
    const today = currentNow.toISOString().slice(0, 10);
    // UTC, nu ora locală a mașinii: serverul rulează pe un VPS, comportarea nu trebuie
    // să depindă de fusul orar al calculatorului pe care pornește procesul.
    if (currentNow.getUTCHours() !== hour || lastRunDate === today) return undefined;
    lastRunDate = today;
    return runBackupCycle({ database, dataDir, keep, historyDays, now: currentNow });
  }

  const timer = setInterval(checkOnce, intervalMs);
  timer.unref?.();
  return { checkOnce, stop: () => clearInterval(timer) };
}
