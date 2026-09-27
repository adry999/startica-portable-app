import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DEFAULT_AUTO_BACKUP_INTERVAL_MS, BRANCH_REGISTRY_FILE_NAME, dataLayout } from '#config/environment.mjs';
import { fail } from '#core/server/errors/domain-error.mjs';
import { readBranchRegistry, createBranchRegistryStore } from '#core/server/branches/branch-registry.mjs';
import { branchDirectories } from '#core/server/branches/branch-layout.mjs';
import { parseKindergartenSettings } from '#shared/domain/kindergarten-settings.mjs';
import { createBranchContext } from './create-branch-context.mjs';

/** @typedef {import('#core/server/branches/branch-registry.mjs').BranchEntry} BranchEntry */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
// Citit o singură dată la încărcarea modulului: versiunea nu se schimbă cât rulează procesul.
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

/**
 * @param {{
 *   root?: string,
 *   dataDir?: string,
 *   backupDir?: string,
 *   home?: string,
 *   logFile?: string,
 *   autoBackupIntervalMs?: number,
 *   allowShutdown?: boolean,
 *   fetch?: typeof fetch,
 * }} [options]
 */
export function createApplication(options = {}) {
  const root = options.root || ROOT;
  // Rădăcina filialelor (registru + folderul Filiale\): implicit rădăcina de date de până acum,
  // ca instalările existente, fără STARTICA_HOME sau root explicit, să nu schimbe nimic (Faza 6, decizia 3).
  const home = options.home ?? options.root ?? ROOT;
  const legacyLayout = dataLayout(home);
  const legacy = {
    dataDir: options.dataDir || legacyLayout.dataDir,
    backupDir: options.backupDir || legacyLayout.backupDir,
  };
  const autoBackupIntervalMs = Number.isFinite(options.autoBackupIntervalMs)
    ? /** @type {number} */ (options.autoBackupIntervalMs)
    : DEFAULT_AUTO_BACKUP_INTERVAL_MS;
  // Tokenul de sesiune se schimbă la fiecare pornire a procesului, nu la fiecare
  // schimbare de filială: o filă rămasă deschisă dintr-o rulare anterioară trebuie
  // să reîncarce înainte să scrie, indiferent pe ce filială scrie.
  const token = randomUUID();
  const registryFile = join(home, BRANCH_REGISTRY_FILE_NAME);
  const registry = createBranchRegistryStore({ file: registryFile, createId: randomUUID });

  let switching = false;
  /** @type {import('./create-branch-context.mjs').createBranchContext extends (...args: any) => infer R ? R : never} */
  let active;

  function shutdownServer() {
    server.close(() => active.close());
    server.closeIdleConnections();
  }

  // Rutele filialelor (Task 3, branches.routes.mjs) sunt adăugate aici, o singură
  // dată; fiecare filială deschisă le include, pentru că ele nu țin de o filială
  // anume — citesc/scriu registrul și comută `active` din afara oricărui context.
  /** @type {import('#core/server/http/route-dispatcher.mjs').RouteDefinition[]} */
  const branchRoutes = [];

  /** @param {BranchEntry} branch */
  function openBranchContext(branch) {
    const dirs = branchDirectories({ home, legacy, branch });
    return createBranchContext({
      branch,
      dataDir: dirs.dataDir,
      backupDir: dirs.backupDir,
      // Home-ul afișat în diagnostic (Task 5, nu în această fază) rămâne exact ce a
      // dat lansatorul, nu rădăcina rezolvată mai sus — un dev fără STARTICA_HOME
      // trebuie să vadă tot „” ca înainte de Faza 6.
      home: options.home,
      logFile: options.logFile,
      root,
      version,
      sessionToken: token,
      autoBackupIntervalMs,
      allowShutdown: !!options.allowShutdown,
      fetch: options.fetch ?? globalThis.fetch,
      shutdown: shutdownServer,
      branchRoutes,
    });
  }

  // Un registru care există dar nu se poate citi oprește pornirea aici, înainte
  // de a deschide vreo bază — altfel am recrea registrul peste folderul unei
  // filiale #2 deja existente (decizia 4 din plan).
  const existingRegistry = readBranchRegistry(registryFile);
  if (existingRegistry) {
    const target =
      existingRegistry.branches.find(branch => branch.id === existingRegistry.lastBranchId) ??
      existingRegistry.branches[0];
    active = openBranchContext(target);
  } else {
    // Filiala #1: rămâne pe folderele vechi, fără nicio mutare de fișier — placeholder-ul
    // de mai jos e înlocuit cu intrarea reală imediat ce citim numele grădiniței din bază.
    active = openBranchContext({ id: '', name: '', color: 'orange', address: '', createdAt: '', folder: null });
    const kindergarten = parseKindergartenSettings(active.readSetting('kindergarten'));
    const created = registry.ensure({
      name: kindergarten.name || 'Filiala principală',
      color: 'orange',
      address: kindergarten.address,
      folder: null,
    });
    active.branch = created.branches.find(branch => branch.folder === null) ?? created.branches[0];
  }

  const server = createServer((req, res) =>
    active.dispatchRequest(req, res, /** @type {import('node:net').AddressInfo} */ (server.address()).port),
  );

  /** @returns {BranchEntry} */
  function activeBranch() {
    return active.branch;
  }

  // Comutarea filialei active (Task 3 o expune prin POST /api/branches/select):
  // backup „schimbare-filiala” pe cea veche, deschidere a celei noi, punctare a
  // `active` spre ea; închiderea celei vechi și sweep-urile celei noi sunt
  // amânate cu un tick, ca răspunsul HTTP să nu aștepte după ele (decizia 2).
  /** @param {string} id */
  function selectBranch(id) {
    if (id === active.branch.id) return active.branch;
    if (switching) fail('Schimbarea filialei e deja în curs.', 409);
    const target = registry.find(id);
    if (!target) fail('Filială inexistentă.', 404);
    switching = true;
    try {
      active.backups.cancelScheduledBackup();
      active.backups.safeBackup('schimbare-filiala');
      let next;
      try {
        next = openBranchContext(target);
      } catch (error) {
        console.error(/** @type {Error} */ (error).stack);
        fail(`Filiala „${target.name}” nu s-a putut deschide: ${/** @type {Error} */ (error).message}`, 500);
      }
      const previous = active;
      active = next;
      registry.setLastBranchId(id);
      setTimeout(() => {
        previous.close();
        next.runStartupSweeps();
      }, 0);
      return next.branch;
    } finally {
      switching = false;
    }
  }

  return {
    server,
    get db() {
      return active.db;
    },
    get database() {
      return active.dbFile;
    },
    /** @param {string} [reason] */
    backup: reason => active.backup(reason),
    /** @param {string} [reason] */
    safeBackup: reason => active.safeBackup(reason),
    health: () => active.health(),
    /** @param {string} [todayStr] */
    expireHealthNotes: todayStr => active.expireHealthNotes(todayStr),
    /** @param {string} [todayStr] */
    expireSmsLog: todayStr => active.expireSmsLog(todayStr),
    refreshExchangeRateIfMissing: () => active.refreshExchangeRateIfMissing(),
    runStartupSweeps: () => active.runStartupSweeps(),
    envelope: () => active.envelope(),
    activeBranch,
    selectBranch,
    registry,
    close: () =>
      /** @type {Promise<void>} */ (
        new Promise(resolveClose => {
          server.close(() => {
            active.close();
            resolveClose();
          });
        })
      ),
  };
}
