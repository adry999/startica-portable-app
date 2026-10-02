import { createServer } from 'node:http';
import { readFileSync, unlinkSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_AUTO_BACKUP_INTERVAL_MS,
  DEFAULT_RELEASE_REPO,
  BRANCH_REGISTRY_FILE_NAME,
  SYNC_DEVICE_FILE_NAME,
  COMMON_DATASET_ID,
  dataLayout,
} from '#config/environment.mjs';
import { fail } from '#core/server/errors/domain-error.mjs';
import { openDatabase } from '#core/server/database/sqlite-connection.mjs';
import { createSettingsRepository } from '#core/server/settings/settings-repository.mjs';
import { readBranchRegistry, createBranchRegistryStore } from '#core/server/branches/branch-registry.mjs';
import { branchDirectories, commonDirectories } from '#core/server/branches/branch-layout.mjs';
import { createFullBackupService, COMMON_ENTRY_ID } from '#features/backup/index.server.mjs';
import { parseKindergartenSettings } from '#shared/domain/kindergarten-settings.mjs';
import {
  createSyncDeviceRepository,
  createSyncHttpClient,
  createSyncConnectService,
  createSyncConnectRoutes,
} from '#features/sync/index.server.mjs';
import { createBranchContext } from './create-branch-context.mjs';
import { createCommonContext } from './create-common-context.mjs';
import { createBranchRoutes } from './branches.routes.mjs';
import { SCHEDULE_FILE_NAME } from './notification-settings.routes.mjs';
import { createUpdateChecker } from './update-check.service.mjs';

/** @typedef {import('#core/server/branches/branch-registry.mjs').BranchEntry} BranchEntry */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
// Citit o singură dată la încărcarea modulului: versiunea nu se schimbă cât rulează procesul.
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
// 42d: aceeași acțiune ca restaurarea legacy (backup.routes.mjs) — un restore din
// Istoric nu are de unde să știe dacă a fost o arhivă completă sau o bază singură.
const RESTORE_AUDIT_ACTION = 'restaurare';

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
 *   releaseRepo?: string,
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
  const registryFile = join(home, BRANCH_REGISTRY_FILE_NAME);
  const registry = createBranchRegistryStore({ file: registryFile, createId: randomUUID });

  // §5.2: un singur checker per proces (nu per filială/schimbare de filială) — verificarea
  // de rețea e aceeași indiferent de filiala activă, deci starea rămâne valabilă peste o
  // schimbare de filială (reopenBranchContext mai jos nu o reconstruiește).
  const updateChecker = createUpdateChecker({
    fetch: options.fetch ?? globalThis.fetch,
    repo: options.releaseRepo || DEFAULT_RELEASE_REPO,
    currentVersion: version,
  });

  // Citit o singură dată la pornirea procesului, ca filiale.json: un sync.json corupt
  // oprește pornirea aici, înainte de a deschide vreo filială (decizia 2 din planul de
  // sincronizare) — nu per filială, pentru că identitatea de dispozitiv e per instalare.
  const syncDevice = createSyncDeviceRepository(join(home, SYNC_DEVICE_FILE_NAME));

  let switching = false;
  /** @type {import('./create-branch-context.mjs').createBranchContext extends (...args: any) => infer R ? R : never} */
  let active;

  // Fixă, la folderul de date al filialei migrate (calea citită de lansator, fără
  // driver SQLite): rămâne aceeași indiferent care filială e activă la salvare
  // (decizia 8 din docs/superpowers/plans/2026-09-27-filiale.md).
  const scheduleFile = join(legacy.dataDir, SCHEDULE_FILE_NAME);

  // Toate folderele de date/backup ale tuturor filialelor, nu doar cea activă: un
  // folder extern nu are voie să fie folderul vreunei filiale (decizia 12 din plan) —
  // funcție, nu o listă calculată o dată, ca o filială adăugată după pornire să fie
  // deja acoperită.
  function forbiddenFolders() {
    const branchFolders = registry.list().flatMap(branch => {
      const dirs = branchDirectories({ home, legacy, branch });
      return [dirs.dataDir, dirs.backupDir];
    });
    const commonFolders = commonDirectories(home);
    return [...branchFolders, commonFolders.dataDir, commonFolders.backupDir];
  }

  function shutdownServer() {
    // A-2: un flux SSE deschis (/api/sync/events) ține o conexiune vie la infinit —
    // server.close(callback) nu ajunge niciodată la callback dacă nu terminăm fluxurile
    // (response.end() — închidere cooperantă, nu o rupere forțată de soclu) înainte.
    active.closeStreams();
    server.close(() => {
      active.close();
      common.close();
    });
    server.closeIdleConnections();
  }

  /** @returns {BranchEntry} */
  function activeBranch() {
    return active.branch;
  }

  // Task 11: conectarea unui calculator (pairing, reconciliere filiale, urcare/descărcare
  // snapshot). `createHttpClient`/`reopenActiveBranch` sunt referite aici înainte de a fi
  // definite mai jos — funcții „function”, deci hoist-uite, la fel ca `openBranchContext`.
  const connectService = createSyncConnectService({
    registry,
    home,
    legacy,
    syncDevice,
    deleteSyncDeviceFile: () => {
      try {
        unlinkSync(join(home, SYNC_DEVICE_FILE_NAME));
      } catch {
        // Lipsa fișierului (deconectare repetată, sau unul care n-a existat) nu e o eroare.
      }
    },
    createHttpClient: options => createSyncHttpClient({ ...options, fetch: globalThis.fetch, clientVersion: version }),
    now: () => new Date(),
    platform: () => process.platform,
    reopenActiveBranch: () => reopenActiveBranch(),
    // `common` nu există încă la acest rând (declarat mai jos) — o închidere, nu o
    // valoare, exact ca `reopenActiveBranch` de mai sus (connect() rulează mult mai
    // târziu, după ce `common` s-a inițializat).
    getCommon: () => common,
    commonDatasetId: COMMON_DATASET_ID,
  });

  // Rutele filialelor sunt construite o singură dată, nu per filială: ele nu
  // țin de o filială anume — citesc/scriu registrul și comută `active` din
  // afara oricărui context (funcțiile de mai jos sunt „function” — hoist-uite,
  // deci pot fi referite aici înainte de a fi apelate mai jos în cod).
  const branchRoutes = /** @type {import('#core/server/http/route-dispatcher.mjs').RouteDefinition[]} */ ([
    ...createBranchRoutes({
      registry,
      home,
      legacy,
      activeBranch,
      selectBranch,
      auditTrail: () => active.auditLogRepository,
    }),
    ...createSyncConnectRoutes({
      syncDevice,
      createHttpClient: options => createSyncHttpClient({ ...options, fetch: globalThis.fetch, clientVersion: version }),
      connectService,
    }),
  ]);

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
      autoBackupIntervalMs,
      allowShutdown: !!options.allowShutdown,
      fetch: options.fetch ?? globalThis.fetch,
      shutdown: shutdownServer,
      listBranches: registry.list,
      scheduleFile,
      forbiddenFolders,
      branchRoutes,
      syncDevice,
      common,
      fullBackupService,
      restoreFullBackup,
      updateStatus: updateChecker.status,
    });
  }

  // Un registru care există dar nu se poate citi oprește pornirea aici, înainte
  // de a deschide vreo bază — altfel am recrea registrul peste folderul unei
  // filiale #2 deja existente (decizia 4 din plan). common se deschide abia după
  // această verificare: un filiale.json corupt nu are voie să lase în urmă un
  // fișier Comun\ pe jumătate pornit, cu handlere pe care nimeni nu le închide
  // (createApplication aruncă mai jos, fără să întoarcă vreun `app` de închis).
  const existingRegistry = readBranchRegistry(registryFile);
  // Baza comună (Personal 24, decizia 1): deschisă o singură dată aici, înainte de
  // prima filială, și ținută deschisă la orice schimbare de filială — nu ține de
  // contextul unei filiale anume, ca syncDevice sau registry mai sus. `let`, nu `const`
  // (42d): restaurarea unei arhive complete suprascrie fișierul ei pe disc, deci
  // conexiunea trebuie închisă și redeschisă — exact ca `active` la o schimbare de filială.
  function buildCommonContext() {
    return createCommonContext({
      home,
      autoBackupIntervalMs,
      version,
      syncDevice,
      fetch: options.fetch ?? globalThis.fetch,
      // Motorul setului comun (decizia 9) transmite statusul/reîncărcarea prin contextul de
      // filială ACTIV la momentul apelului — `active` se schimbă la fiecare schimbare de
      // filială/comutare, dar aceste închideri rămân valabile (closures, nu o referință
      // capturată o singură dată la construcție).
      onSyncStatus: () => active.notifySyncStatus(),
      onSyncRecordsChanged: revision => active.notifyCommonRecordsChanged(revision),
    });
  }
  let common = buildCommonContext();

  // 42d: arhiva completă (toate bazele) — construită o singură dată aici, ca `common`
  // de mai sus, și pasată gata construită oricărui context de filială deschis (decizia
  // „pasul 6” din docs/superpowers/plans/2026-10-01-backup-complet.md). `backupDirectory`/
  // `readSetting`/`writeSetting` citesc setările FILIALEI ACTIVE la momentul apelului —
  // closures, nu valori capturate o singură dată, la fel ca restul funcțiilor de mai sus.
  const fullBackupService = createFullBackupService({
    registry,
    home,
    legacy,
    activeBranch: () => ({ branch: active.branch, db: active.db }),
    common: () => ({ db: common.db }),
    backupDirectory: () => active.backupDir,
    readSetting: key => active.readSetting(key),
    writeSetting: (key, value) => active.writeSetting(key, value),
    appVersion: version,
  });

  try {
    if (existingRegistry) {
      const target =
        existingRegistry.branches.find(branch => branch.id === existingRegistry.lastBranchId) ??
        existingRegistry.branches[0];
      active = openBranchContext(target);
    } else {
      // Filiala #1 rămâne pe folderele vechi, fără nicio mutare de fișier (decizia 4). Numele
      // grădiniței vine dintr-o citire scurtă, separată — contextul complet se deschide o
      // singură dată, mai jos, cu filiala deja cunoscută (nu un placeholder rescris ulterior,
      // ca rutele de sesiune să nu prindă o referință veche la `branch`).
      const { db: bootstrapDb } = openDatabase({ dataDir: legacy.dataDir, backupDir: legacy.backupDir });
      const bootstrapSetting = /** @type {(key: string) => string} */ (createSettingsRepository(bootstrapDb).setting);
      const kindergarten = parseKindergartenSettings(bootstrapSetting('kindergarten'));
      bootstrapDb.close();
      const created = registry.ensure({
        name: kindergarten.name || 'Filiala principală',
        color: 'orange',
        address: kindergarten.address,
        folder: null,
      });
      active = openBranchContext(created.branches.find(branch => branch.folder === null) ?? created.branches[0]);
    }
  } catch (error) {
    // Filiala nu s-a putut deschide (bază coruptă) — nimeni nu mai primește un `app` de
    // închis, deci common trebuie închis chiar aici, altfel rămâne blocat pe disc.
    common.close();
    throw error;
  }

  const server = createServer((req, res) =>
    active.dispatchRequest(req, res, /** @type {import('node:net').AddressInfo} */ (server.address()).port),
  );

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
      // A-3: scrierea registrului înainte de a comuta `active` — un eșec aici (disc plin,
      // filiale.json.tmp blocat) înseamnă filiala nu s-a schimbat, nu „s-a schimbat, dar
      // răspunsul a picat”. Contextul nou deschis nu are voie să rămână agățat (db, timere).
      try {
        registry.setLastBranchId(id);
      } catch (error) {
        next.close();
        console.error(/** @type {Error} */ (error).stack);
        fail(`Filiala nu s-a putut selecta: ${/** @type {Error} */ (error).message}`, 500);
      }
      const previous = active;
      active = next;
      setTimeout(() => {
        // Un eșec aici (bază coruptă, timer blocat) nu are voie să devină uncaughtException
        // (main.mjs ar închide tot procesul) — filiala nouă e deja activă, sweep-urile și
        // sincronizarea ei trebuie să pornească oricum, chiar dacă închiderea celei vechi eșuează.
        try {
          previous.close();
        } catch (error) {
          const failure = /** @type {Error} */ (error);
          console.error('Închiderea filialei anterioare a eșuat: ' + (failure.stack || failure));
        } finally {
          next.runStartupSweeps();
          next.startSync();
        }
      }, 0);
      return next.branch;
    } finally {
      switching = false;
    }
  }

  // Task 11: după connect/disconnect, filiala activă trebuie recreată — connect scrie
  // sync.json (motorul pornește abia acum) sau, dacă filiala activă era cea goală
  // înlocuită (replaceEmpty), id-ul ei s-a schimbat. Potrivirea se face după `folder`
  // (stabil la replaceEmpty), nu după `id` (poate fi tocmai cel schimbat) — la fel ca un
  // `selectBranch`, dar declanșat din interior, nu dintr-o cerere HTTP cu un id anume.
  function reopenActiveBranch() {
    const target =
      registry.list().find(branch => branch.folder === active.branch.folder) ??
      registry.find(active.branch.id) ??
      registry.list()[0];
    if (!target) return;
    let next;
    try {
      next = openBranchContext(target);
    } catch (error) {
      console.error(/** @type {Error} */ (error).stack);
      return;
    }
    const previous = active;
    active = next;
    // Conectarea/deconectarea (sync.json creat sau șters) e singurul moment în care motorul
    // setului comun trebuie reconstruit — altfel rulează mai departe pe clientul vechi
    // (decizia 9): reopenActiveBranch e chemat de sync-connect.service.mjs exact la connect()
    // și disconnect(), niciodată la o simplă schimbare de filială (selectBranch, mai jos).
    common.reconnectSync();
    setTimeout(() => {
      try {
        previous.close();
      } catch (error) {
        const failure = /** @type {Error} */ (error);
        console.error('Închiderea filialei anterioare a eșuat: ' + (failure.stack || failure));
      } finally {
        next.runStartupSweeps();
        next.startSync();
      }
    }, 0);
  }

  // 42d: restaurare dintr-o arhivă .startica-backup — fullBackupService.restore() a validat
  // deja versiunea/integritatea/numărătorile fiecărei baze (vezi full-backup.service.mjs)
  // înainte ca acest `apply` să ajungă să scrie vreun fișier; un eșec de validare aruncă
  // înainte de orice schimbare pe disc, deci arhiva originală rămâne neatinsă.
  // Ordinea (decizia 8 din plan): backup de siguranță complet ÎNTÂI (nu poate eșua
  // silențios — un eșec aici oprește tot, propagă eroarea mai sus) → Comun închis/
  // suprascris/redeschis → filialele neactive suprascrise direct (nicio conexiune) →
  // filiale.json înlocuit EXACT cu lista din manifest (decizia 7, nu o îmbinare) →
  // filiala activă închisă/suprascrisă/redeschisă ABIA ACUM (fișierul ei trebuia să
  // rămână deschis până la acest punct, cât se validează arhiva și se scriu celelalte baze).
  /** @param {string} file */
  function restoreFullBackup(file) {
    fullBackupService.backup('inainte-restaurare');

    fullBackupService.restore(file, {
      apply: ({ manifest, databaseFiles }) => {
        const commonBuffer = databaseFiles.get(COMMON_ENTRY_ID);
        if (commonBuffer) {
          common.close();
          const commonDirs = commonDirectories(home);
          mkdirSync(commonDirs.dataDir, { recursive: true });
          writeFileSync(join(commonDirs.dataDir, 'startica.db'), commonBuffer);
          common = buildCommonContext();
        }

        const existingBranches = registry.list();
        const previousActiveBranch = active.branch;
        /** @type {BranchEntry[]} */
        const nextBranches = [];
        /** @type {Buffer | null} */
        let activeBuffer = null;

        for (const entry of manifest.databases) {
          if (entry.kind !== 'branch') continue;
          const buffer = /** @type {Buffer} */ (databaseFiles.get(entry.id));
          if (entry.id === manifest.activeBranchId) {
            // Scrisă peste fișierul filialei active CURENTE, indiferent ce id/folder avea
            // în arhivă — pe alt calculator, „filiala activă” n-are niciun corespondent
            // natural în afară de slotul deja deschis acolo.
            nextBranches.push(previousActiveBranch);
            activeBuffer = buffer;
            continue;
          }
          // Un id deja cunoscut local își păstrează folderul; unul nou e adoptat cu exact
          // id-ul din arhivă (ca sincronizarea ei, dacă există, să rămână legată de el).
          const branchEntry =
            existingBranches.find(candidate => candidate.id === entry.id) ??
            registry.adopt({
              id: entry.id,
              name: entry.name,
              color: 'orange',
              address: '',
              createdAt: new Date().toISOString(),
            });
          nextBranches.push(branchEntry);
          const dirs = branchDirectories({ home, legacy, branch: branchEntry });
          mkdirSync(dirs.dataDir, { recursive: true });
          writeFileSync(join(dirs.dataDir, 'startica.db'), buffer);
        }

        // O filială locală absentă din manifest dispare din filiale.json (decizia 7) —
        // fișierul ei rămâne orfan pe disc, neșters, recuperabil manual.
        registry.replaceAll(nextBranches, previousActiveBranch.id);

        active.close();
        if (activeBuffer) {
          const dirs = branchDirectories({ home, legacy, branch: previousActiveBranch });
          mkdirSync(dirs.dataDir, { recursive: true });
          writeFileSync(join(dirs.dataDir, 'startica.db'), activeBuffer);
        }
        active = openBranchContext(previousActiveBranch);
        // Scrisă în baza PROASPĂT restaurată (nu în cea de dinainte, care tocmai a fost
        // suprascrisă) — la fel ca restaurarea legacy, apare în Istoric (45a).
        active.auditLogRepository.recordChange({
          action: RESTORE_AUDIT_ACTION,
          recordType: null,
          recordId: null,
          before: null,
          after: { sursa: 'arhiva completa', baze: manifest.databases.map(entry => entry.name) },
        });
      },
    });

    active.runStartupSweeps();
    active.startSync();
    common.startSync();
  }

  return {
    server,
    get db() {
      return active.db;
    },
    get database() {
      return active.dbFile;
    },
    // PROMPT-9 §8: testele cursului BNM/planurilor (acum în baza comună) trebuie să poată
    // pregăti/verifica direct `settings`, la fel cum `db` de mai sus o face pentru filiala
    // activă — altfel n-ar avea cum să ajungă la fișierul Comun\Startica_Date\startica.db.
    get commonDb() {
      return common.db;
    },
    // common.safeBackup rulează întâi și nu aruncă niciodată: o filială care nu se
    // poate copia (disc plin, blocaj) nu are voie să lase Comun\ fără propria copie.
    /** @param {string} [reason] */
    backup: reason => {
      common.safeBackup(reason);
      return active.backup(reason);
    },
    /** @param {string} [reason] */
    safeBackup: reason => {
      common.safeBackup(reason);
      return active.safeBackup(reason);
    },
    health: () => active.health(),
    fullBackupService,
    /** @param {string} file */
    restoreFullBackup: file => restoreFullBackup(file),
    /** @param {string} [todayStr] */
    expireHealthNotes: todayStr => active.expireHealthNotes(todayStr),
    /** @param {string} [todayStr] */
    expireSmsLog: todayStr => active.expireSmsLog(todayStr),
    refreshExchangeRateIfMissing: () => active.refreshExchangeRateIfMissing(),
    refreshTomorrowRateIfMissing: () => active.refreshTomorrowRateIfMissing(),
    // §5.2: verificare de rețea explicită (pornire + o dată la 6 ore, vezi main.mjs) — nu
    // aruncă niciodată (createUpdateChecker/checkForUpdate), doar actualizează updateStatus().
    checkForUpdate: () => updateChecker.refresh(),
    updateStatus: () => updateChecker.status(),
    runStartupSweeps: () => active.runStartupSweeps(),
    // Pornirea motorului de sincronizare al filialei active (Faza 3) — separată de
    // runStartupSweeps() pentru că lansatorul (main.mjs) o apelă tot amânat, dar
    // aceleași teste care nu pornesc niciun server real trebuie să poată porni
    // aplicația fără să declanșeze cereri de rețea neintenționat. Motorul setului comun
    // (decizia 9) pornește aici o singură dată — nu mai e reconstruit/repornit la
    // schimbarea filialei (spre deosebire de cel al filialei active).
    startSync: () => {
      common.startSync();
      active.startSync();
    },
    envelope: () => active.envelope(),
    activeBranch,
    selectBranch,
    registry,
    // Închidere sincronă, fără serverul HTTP (teste care nu ascultă niciodată pe port):
    // `common` e o a doua bază, deschisă separat — un test care închidea doar `app.db`
    // ar lăsa fișierul ei blocat pe disc la ștergerea folderului temporar.
    closeSync: () => {
      active.close();
      common.close();
    },
    close: () =>
      /** @type {Promise<void>} */ (
        new Promise(resolveClose => {
          // Aceeași cursă ca în shutdownServer: fără closeStreams() înainte, un flux SSE
          // deschis ar bloca la infinit callback-ul lui server.close() de mai jos.
          active.closeStreams();
          server.close(() => {
            active.close();
            common.close();
            resolveClose();
          });
        })
      ),
  };
}
