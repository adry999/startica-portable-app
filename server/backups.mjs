import { existsSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { emptyState } from '../domain.mjs';
import { fail, hash, sqlString, stamp, discard } from './util.mjs';

const BACKUP_NAME = /^startica_[A-Za-z0-9_.-]+\.db$/;
const TEMPORARY_NAME = /^startica_[A-Za-z0-9_.-]+\.db\.tmp$/;
// Un .tmp mai nou decât atât poate aparține unui backup aflat în curs.
const TEMPORARY_GRACE_MS = 3600000;

// Ce se păstrează: ultimele 20 de copii, câte una pentru fiecare din ultimele
// 30 de zile și 12 luni cu backup, plus copiile dinaintea unei operațiuni
// ireversibile, care nu expiră.
export function retentionKeep(files) {
  const sorted = [...files].sort((a, b) => b.modified.localeCompare(a.modified));
  const keep = new Set(sorted.slice(0, 20).map(f => f.name)),
    days = new Set(),
    months = new Set();
  for (const f of sorted) {
    const day = f.modified.slice(0, 10),
      month = day.slice(0, 7);
    if (!days.has(day) && days.size < 30) {
      days.add(day);
      keep.add(f.name);
    }
    if (!months.has(month) && months.size < 12) {
      months.add(month);
      keep.add(f.name);
    }
    if (/inainte-|migrare/.test(f.name)) keep.add(f.name);
  }
  return keep;
}

// Citește o copie și verifică integritatea ei. Folosit atât la previzualizarea
// unei restaurări, cât și ca validare a fiecărui backup înainte de a fi acceptat.
export function snapshotState(file) {
  const source = new DatabaseSync(file, { readOnly: true });
  try {
    if (source.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') fail('Backup corupt.');
    if (source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='records'").get()) {
      const s = emptyState();
      for (const r of source.prepare('SELECT kind,payload FROM records').all()) s[r.kind].push(JSON.parse(r.payload));
      return s;
    }
    return JSON.parse(source.prepare('SELECT payload FROM app_state WHERE id=1').get().payload);
  } finally {
    source.close();
  }
}

export function fileList(dir) {
  return readdirSync(dir)
    .filter(n => BACKUP_NAME.test(n))
    .map(name => ({ name, modified: statSync(join(dir, name)).mtime.toISOString() }))
    .sort((a, b) => b.modified.localeCompare(a.modified));
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

export function createBackups({ db, dbFile, backupDir, setting, setSetting, autoBackupIntervalMs }) {
  let lastBackupAt = 0,
    scheduled = null;

  function prune() {
    const files = fileList(backupDir),
      keep = retentionKeep(files);
    for (const f of files) if (!keep.has(f.name)) unlinkSync(join(backupDir, f.name));
    pruneTemporary(backupDir);
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
    const external = setting('externalDir');
    if (!external) return '';
    const copy = join(external, name) + '.tmp';
    let warning = '';
    try {
      if (!existsSync(external) || !statSync(external).isDirectory()) fail('Folderul extern nu este disponibil.');
      copyFileSync(file, copy);
      if (hash(readFileSync(file)) !== hash(readFileSync(copy))) fail('Copia externă diferă de original.');
      snapshotState(copy);
      renameSync(copy, join(external, name));
      setSetting('lastExternal', new Date().toISOString());
      setSetting('externalError', '');
    } catch (e) {
      discard(copy);
      warning = 'Backup local creat; copia externă a eșuat: ' + e.message;
      setSetting('externalError', e.message);
    }
    try {
      pruneTemporary(external);
    } catch {}
    return warning;
  }

  // Copie verificată: VACUUM INTO într-un .tmp, deschidere și verificare a
  // integrității, abia apoi redenumire. Un fișier cu nume final este întotdeauna
  // o copie validă.
  function backup(reason = 'manual') {
    const name = `startica_${stamp()}_${reason}_${randomUUID().slice(0, 8)}.db`,
      file = join(backupDir, name),
      temp = file + '.tmp';
    try {
      db.exec(`VACUUM INTO ${sqlString(temp)}`);
      snapshotState(temp);
      renameSync(temp, file);
    } catch (e) {
      discard(temp);
      throw e;
    }
    setSetting('lastLocal', new Date().toISOString());
    setSetting('localError', '');
    // Orice copie reușită repornește ceasul și anulează copia programată,
    // indiferent de motiv: pornire, manual sau dinaintea unui import.
    lastBackupAt = Date.now();
    cancelScheduledBackup();
    let warning = copyExternally(name, file);
    try {
      prune();
    } catch (e) {
      warning += ' Curățarea backupurilor vechi a eșuat: ' + e.message;
    }
    return { file, name, warning };
  }

  function safeBackup(reason) {
    try {
      return backup(reason);
    } catch (e) {
      setSetting('localError', e.message);
      return { warning: 'Datele sunt salvate, dar backupul local a eșuat: ' + e.message };
    }
  }

  // Backupul de după o salvare obișnuită. Copia integrală a bazei nu are ce
  // căuta pe calea fiecărei cereri: datele sunt durabile la COMMIT, copia
  // servește la recuperare. O eroare anterioară se reîncearcă imediat, altfel
  // utilizatorul ar afla că backupul nu funcționează abia după expirarea
  // intervalului.
  function autoBackup() {
    const retrying = !!(setting('localError') || setting('externalError'));
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
    const stored = setting('externalError');
    if (stored) return stored;
    const dir = setting('externalDir');
    if (!dir) return '';
    try {
      return existsSync(dir) && statSync(dir).isDirectory() ? '' : 'Folderul extern nu este disponibil.';
    } catch (e) {
      return e.message;
    }
  }

  function health() {
    return {
      ok: true,
      database: dbFile,
      backup: backupDir,
      externalDir: setting('externalDir'),
      lastLocal: setting('lastLocal') || fileList(backupDir)[0]?.modified || '',
      lastExternal: setting('lastExternal'),
      localError: setting('localError'),
      externalError: externalFailure(),
      cloudVerified: false,
    };
  }

  // Numele vine de la client: trebuie să fie un nume simplu de fișier din
  // folderul de backup, niciodată o cale.
  function selectedBackup(name) {
    if (typeof name !== 'string' || basename(name) !== name || !BACKUP_NAME.test(name)) fail('Nume de backup invalid.');
    const file = join(backupDir, name);
    if (!existsSync(file)) fail('Backup inexistent.');
    return file;
  }

  return {
    backup,
    safeBackup,
    autoBackup,
    health,
    selectedBackup,
    cancelScheduledBackup,
    list: () => fileList(backupDir),
  };
}
