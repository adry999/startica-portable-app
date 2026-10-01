// Pregătește o copie izolată a datelor pentru capturi de design (PROMPT-CLAUDE-CODE-6.md §3) —
// serverul de dezvoltare nu pornește NICIODATĂ pe `Startica_Date/` reală din rădăcina repo-ului.
// Rulat direct: copiază datele, apoi pornește serverul (pe copie) și `webapp` dev împreună.
// Rulat ca modul (`copyDevData()`): doar copiază, pentru alte scripturi (ex. design-capture.mjs).
import { existsSync, cpSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const COPY_ROOT = join(REPO_ROOT, '.tmp', 'data-copy');

// Doar folderele/fișierele care țin date (fără Startica_Backup/Jurnale — create automat la
// pornire). `sync.json` NU se copiază niciodată — absența lui e exact ce ține sincronizarea
// oprită în copie (vezi create-application.mjs: sync.json lipsă = sync neconfigurat).
const DATA_ENTRIES = ['Startica_Date', 'Comun', 'Filiale', 'filiale.json'];

/** Caută recursiv toate bazele `startica.db` active (nu și copiile din `Startica_Backup/`) sub un folder.
 * @param {string} dir
 * @returns {string[]}
 */
function findLiveDatabases(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'Startica_Backup') continue;
      found.push(...findLiveDatabases(path));
    } else if (entry.name === 'startica.db') {
      found.push(path);
    }
  }
  return found;
}

// `externalDir` (setare de backup extern, ex. un folder Google Drive) stă ÎN baza de date, nu
// derivă din STARTICA_HOME — o copie a bazei „moștenește” calea reală. Fără neutralizare,
// backup-ul de pornire (main.mjs, app.backup('pornire')) ar scrie un fișier real în afara
// `.tmp/`, pe folderul extern al instalării adevărate (incident constatat 01.10 — vezi INTREBARI.md).
/** @param {string} copyRoot */
function neutralizeExternalBackupSetting(copyRoot) {
  for (const dbFile of findLiveDatabases(copyRoot)) {
    const db = new DatabaseSync(dbFile);
    try {
      db.exec("DELETE FROM settings WHERE key = 'externalDir'");
    } finally {
      db.close();
    }
  }
}

/** Copiază datele reale într-un folder temporar, recreat de la zero la fiecare apel.
 * @returns {string} calea absolută a copiei (de folosit ca STARTICA_HOME)
 */
export function copyDevData() {
  const copyRoot = resolve(COPY_ROOT);
  const tmpRoot = resolve(REPO_ROOT, '.tmp');
  if (copyRoot !== tmpRoot && !copyRoot.startsWith(tmpRoot + sep))
    throw new Error(`Cale de copiere neașteptată, oprire de siguranță: ${copyRoot}`);

  rmSync(copyRoot, { recursive: true, force: true });
  mkdirSync(copyRoot, { recursive: true });

  for (const entry of DATA_ENTRIES) {
    const source = join(REPO_ROOT, entry);
    if (existsSync(source)) cpSync(source, join(copyRoot, entry), { recursive: true });
  }

  if (existsSync(join(copyRoot, 'sync.json')))
    throw new Error('sync.json ajuns în copie — oprire de siguranță (sincronizarea trebuie să rămână oprită).');

  neutralizeExternalBackupSetting(copyRoot);

  return copyRoot;
}

/**
 * Pornește serverul pe o copie izolată (STARTICA_PORT=0 — port liber, ca să nu intre în
 * conflict cu un server deja pornit pe baza reală) și așteaptă `startica.port` (scris atomic
 * de main.mjs la pornire — console.log al serverului merge în Jurnale/, nu în acest terminal,
 * de îndată ce STARTICA_HOME e setat).
 * @param {string} copyRoot
 * @returns {Promise<{ child: import('node:child_process').ChildProcess, port: number }>}
 */
export async function startCopyServer(copyRoot) {
  const portFile = join(copyRoot, 'startica.port');
  const child = spawn(process.execPath, ['startica_server.mjs'], {
    cwd: REPO_ROOT,
    env: { ...process.env, STARTICA_HOME: copyRoot, STARTICA_PORT: '0', STARTICA_NO_BROWSER: '1' },
    stdio: 'inherit',
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (existsSync(portFile)) return { child, port: JSON.parse(readFileSync(portFile, 'utf8')).port };
    if (child.exitCode !== null) throw new Error('Serverul pe copie s-a oprit înainte să scrie startica.port.');
    await delay(100);
  }
  throw new Error(`startica.port nu a apărut în ${portFile} (10s).`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const copyRoot = copyDevData();
  console.log(`[dev:copy] date copiate în ${copyRoot}`);
  console.log('[dev:copy] sincronizare: oprită (niciun sync.json în copie)');

  const { child: server, port } = await startCopyServer(copyRoot);
  console.log(`[dev:copy] server pe copie: http://127.0.0.1:${port}`);

  const webapp = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], {
    cwd: join(REPO_ROOT, 'webapp'),
    env: { ...process.env, STARTICA_API_PORT: String(port) },
    stdio: 'inherit',
  });

  function shutdown() {
    server.kill();
    webapp.kill();
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  server.on('exit', shutdown);
  webapp.on('exit', shutdown);
}
