import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { fail } from '#core/server/errors/domain-error.mjs';
import { openDatabase, openDatabaseReadOnly } from '#core/server/database/sqlite-connection.mjs';
import { readSettingValue, writeSettingValue } from '#core/server/settings/settings-repository.mjs';
import { sqlStringLiteral } from '#core/server/database/sql-string-literal.mjs';
import { fileTimestamp } from '#core/server/files/file-timestamp.mjs';
import { branchDirectories, countBranchRecords } from '#core/server/branches/branch-layout.mjs';
import {
  readLocalSnapshot,
  writeLocalSnapshot,
  overwriteLocalSnapshot,
  readCommonSnapshot,
  writeCommonSnapshot,
} from './snapshot-io.mjs';

// B-4: aceeași cheie ca sync-engine.service.mjs/snapshot-io.mjs — nu importată de acolo
// (fiecare modul o repetă local) ca să nu lege connect-ul de motor doar pentru o constantă.
const SYNC_SINCE_SETTING = 'sync.since';
// S-3: scrisă la disconnect(), ÎNAINTE de resetSyncState (care nu o atinge — șterge doar
// „sync.since” din settings) — singura urmă care supraviețuiește deconectării și permite
// connect() să recunoască „același calculator revenit” în loc de un filiale.json copiat.
const SYNC_LAST_SERVER_URL_SETTING = 'sync.last_server_url';

/** @param {string} dataDir */
function isBranchEmpty(dataDir) {
  const counts = countBranchRecords(dataDir);
  return counts.children === 0 && counts.groups === 0;
}

/**
 * B-4: filiala a mai sincronizat vreodată cu un server (are `sync_state` local)? Dacă da,
 * o filială nevidă care „există deja pe server” nu e un filiale.json copiat — e chiar
 * acest calculator, reconectat. Eșecul de citire (bază fără tabelele de sincronizare încă,
 * sau alt motiv) înseamnă „nu știm” — tratat ca „nu”, adică rămâne verificarea de mai jos.
 * @param {string} dataDir
 */
function hasLocalSyncState(dataDir) {
  const opened = openDatabaseReadOnly({ dataDir });
  if (!opened) return false;
  try {
    return !!opened.db.prepare('SELECT 1 FROM sync_state LIMIT 1').get();
  } catch {
    return false;
  } finally {
    opened.db.close();
  }
}

/**
 * S-3: ultimul server la care s-a conectat această bază (filială sau setul comun) —
 * scris la disconnect(), înainte de resetSyncState, ca connect() să poată distinge
 * „același calculator revenit” (409 altfel, vezi hasLocalSyncState mai sus, golit de
 * disconnect) de un filiale.json copiat pe alt calculator. Eșecul de citire = „nu știm”.
 * @param {string} dataDir
 */
function readLastServerUrl(dataDir) {
  const opened = openDatabaseReadOnly({ dataDir });
  if (!opened) return '';
  try {
    return readSettingValue(opened.db, SYNC_LAST_SERVER_URL_SETTING) || '';
  } catch {
    return '';
  } finally {
    opened.db.close();
  }
}

/**
 * S-3: copie de siguranță înainte de a suprascrie o filială nevidă cu instantaneul
 * serverului (reconectare pe același server) — aceeași convenție ca „inainte-…” din
 * runRevisionTransaction/sync-engine.service.mjs (`resyncFromSnapshot`), dar autonomă
 * (fără createBackupService, care cere ancore de instalare — readSetting/forbiddenFolders
 * — pe care connect() nu le are aici): un simplu VACUUM INTO, vizibil în lista de backup-uri
 * (același format de nume, `startica_<timestamp>_<motiv>_<id scurt>.db`).
 * @param {import('node:sqlite').DatabaseSync} db @param {string} backupDir @param {string} reason
 */
function backupBeforeOverwrite(db, backupDir, reason) {
  const file = join(backupDir, `startica_${fileTimestamp()}_${reason}_${randomUUID().slice(0, 8)}.db`);
  db.exec(`VACUUM INTO ${sqlStringLiteral(file)}`);
  return file;
}

/**
 * B-4: golește starea de sincronizare a unei baze (filială sau setul comun) — apelată la
 * `disconnect()`. Rândurile din outbox NU se șterg (editările netrimise nu trebuie
 * pierdute), se arhivează, ca să nu mai plece la o viitoare conectare cu o revizie de bază
 * care n-are ce să mai însemne pe un server nou (sau același, reconectat de la zero).
 * S-3: `serverUrl` (dacă dat) se scrie ÎNAINTE de ștergeri, în aceeași tranzacție — cheia ei
 * (`sync.last_server_url`) nu e `sync.since`, deci „DELETE FROM settings WHERE key=?” de mai
 * jos n-o atinge; supraviețuiește resetului, exact ce are nevoie connect() să recunoască
 * „același calculator revenit”.
 * @param {import('node:sqlite').DatabaseSync} db @param {{ serverUrl?: string }} [options]
 */
function resetSyncState(db, { serverUrl } = {}) {
  db.exec('BEGIN IMMEDIATE');
  try {
    if (serverUrl) writeSettingValue(db, SYNC_LAST_SERVER_URL_SETTING, serverUrl);
    db.prepare('DELETE FROM sync_state').run();
    db.prepare('DELETE FROM sync_conflicts').run();
    db.prepare('DELETE FROM settings WHERE key=?').run(SYNC_SINCE_SETTING);
    db.prepare("UPDATE sync_outbox SET status='archived' WHERE status IN ('pending','parked')").run();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Conectarea unui calculator la serverul de sincronizare (Task 11, decizia 9 din
 * 2026-09-27-sincronizare.md): perechea, apoi reconcilierea filialelor — fiecare
 * filială locală cu date se urcă o singură dată; o filială locală goală preia
 * (adoptă) prima filială de pe server neprezentă local, în locul ei; restul
 * filialelor de pe server, neprezente local, sunt adoptate ca filiale noi și
 * descărcate în Filiale\<slug>. Rulează sincron, bazele deschise una câte una.
 * @param {{
 *   registry: import('#core/server/branches/branch-registry.mjs').BranchRegistryStore,
 *   home: string,
 *   legacy: { dataDir: string, backupDir: string },
 *   syncDevice: { read: () => import('../sync.types.d.mts').SyncDeviceFile | null, write: (device: any) => void, clear: () => void },
 *   deleteSyncDeviceFile: () => void,
 *   createHttpClient: (options: { serverUrl: string, token?: string }) => ReturnType<typeof import('./sync-http-client.mjs').createSyncHttpClient>,
 *   now: () => Date,
 *   platform: () => string,
 *   reopenActiveBranch: () => void,
 *   getCommon?: () => { db: import('node:sqlite').DatabaseSync, kinds: { list: (kind: string) => { id: string }[], save: (kind: string, record: { id: string } & Record<string, unknown>) => unknown, transaction: <T>(fn: () => T) => T }, sync: { outbox: { enqueue: (change: { kind: string, recordId: string, payload: unknown }) => unknown } } } | undefined,
 *   commonDatasetId?: string,
 * }} dependencies
 */
export function createSyncConnectService({
  registry,
  home,
  legacy,
  syncDevice,
  deleteSyncDeviceFile,
  createHttpClient,
  now,
  platform,
  reopenActiveBranch,
  // Neconfigurate implicit — un test care nu le dă (harness-ul existent, reconciliere de
  // filiale) nu atinge deloc setul comun, exact comportamentul de dinainte de Personal 24.
  getCommon = () => undefined,
  commonDatasetId = 'comun',
}) {
  /** @param {import('#core/server/branches/branch-registry.mjs').BranchEntry} branch */
  const dirsOf = branch => branchDirectories({ home, legacy, branch });

  /**
   * @param {{ serverUrl: string, code?: string, setupKey?: string, deviceName: string, os?: string }} input
   */
  async function connect({ serverUrl, code, setupKey, deviceName, os }) {
    if (!deviceName) fail('Numele calculatorului este obligatoriu.', 400);
    const pairClient = createHttpClient({ serverUrl });
    const paired = await pairClient.pair({ code, setupKey, name: deviceName, os: os || platform() });
    const client = createHttpClient({ serverUrl, token: paired.token });

    // B-9: codul de asociere e deja ars și dispozitivul deja înregistrat pe server din
    // `pair()` de mai sus — orice eșec de-acum încolo (reconciliere de filiale, urcare/
    // descărcare de instantanee, setul comun) ar lăsa un rând fantomă în „Calculatoare
    // conectate” pe celălalt calculator, fără niciun sync.json local și fără nicio cale
    // de reluare (codul nu mai poate fi refolosit). Revocă propriul dispozitiv — același
    // apel ca „DECONECTEAZĂ” din DevicesList.tsx — înainte să retrimită eroarea originală.
    try {
      return await finishConnecting({ client, serverUrl, paired, deviceName });
    } catch (error) {
      try {
        await client.revokeDevice(paired.deviceId);
      } catch {
        // Cel mai bine posibil: dacă nici revocarea nu reușește (serverul tocmai a căzut),
        // eroarea originală tot trebuie să ajungă la utilizator — nu-i ascundem cauza.
      }
      throw error;
    }
  }

  /**
   * Restul lui `connect()`, după `pair()` — separat ca `catch`-ul de mai sus (B-9) să
   * învelească exact partea care poate eșua fără cale de reluare, nu și `pair()` însuși.
   * Închidere peste `now`/`commonDatasetId` din `createSyncConnectService` — nu parametri,
   * ca `pair()` de mai sus.
   * @param {{
   *   client: ReturnType<typeof import('./sync-http-client.mjs').createSyncHttpClient>,
   *   serverUrl: string, paired: { deviceId: string, token: string }, deviceName: string,
   * }} params
   */
  async function finishConnecting({ client, serverUrl, paired, deviceName }) {
    // S-5: preluat aici (nu doar mai jos, unde era folosit pentru contopirea setului comun)
    // — adoptarea unei filiale goale (mai jos, replaceEmpty) schimbă id-ul filialei locale,
    // iar setul comun poate avea deja `staff`/`salary_payments` care țin id-ul VECHI (Personal
    // se poate folosi pe filiala implicită înainte de „Conectează”). Remapate mai jos.
    const common = getCommon();
    const { branches: serverBranches } = await client.listBranches();
    const localBranches = registry.list();
    const localIds = new Set(localBranches.map(branch => branch.id));
    const claimedServerIds = new Set();
    /** @type {{ oldId: string, newId: string }[]} */
    const branchIdRemaps = [];

    /** @type {{ id: string, name: string }[]} */
    const uploaded = [];
    /** @type {{ id: string, name: string }[]} */
    const downloaded = [];
    /** @type {{ localId: string, serverBranch: { id: string, name: string, color: string, address: string, createdAt: string } }[]} */
    const toDownload = [];
    /** @type {import('#core/server/branches/branch-registry.mjs').BranchEntry[]} */
    const toUpload = [];
    /** @type {{ local: import('#core/server/branches/branch-registry.mjs').BranchEntry, serverSnapshot: Awaited<ReturnType<typeof client.downloadSnapshot>> }[]} */
    const sameServerReconnects = [];

    for (const local of localBranches) {
      const serverMatch = serverBranches.find(branch => branch.id === local.id);
      if (serverMatch) {
        claimedServerIds.add(serverMatch.id);
        if (isBranchEmpty(dirsOf(local).dataDir)) {
          toDownload.push({ localId: local.id, serverBranch: serverMatch });
          continue;
        }
        // B-4: filiala nu e goală local ȘI există deja pe server — nu neapărat un
        // filiale.json copiat (singurul caz tratat înainte). Două situații legitime,
        // altfel respinse cu un 409 fără nicio cale de reluare:
        //  - reconectare pe ACELAȘI calculator: `sync_state` local nevid înseamnă că
        //    filiala asta a mai sincronizat cu un server, cândva — nimic de urcat sau
        //    descărcat, motorul reia normal de unde a rămas (`sync.since`).
        //  - conectare întreruptă între înregistrarea filialei și încărcarea ei (rețea
        //    căzută, sau corpul depășește limita serverului): filiala există pe server,
        //    dar n-a primit încă nicio dată (`headSeq` 0) — reia încărcarea, nu respinge.
        if (hasLocalSyncState(dirsOf(local).dataDir)) continue;
        const serverSnapshot = await client.downloadSnapshot(serverMatch.id);
        if (serverSnapshot.headSeq === 0) {
          toUpload.push(local);
          continue;
        }
        // S-3: `disconnect()` tocmai a golit `sync_state` (verificarea de mai sus) — dar dacă
        // ultimul server la care s-a conectat ACEASTĂ bază e chiar cel de-acum
        // (`sync.last_server_url`, scris la disconnect, înainte de reset), e același
        // calculator revenit, nu un filiale.json copiat: descarcă instantaneul serverului
        // peste local (cu backup înainte — ca la o resincronizare 410; editările offline
        // oricum n-au ajuns în outbox, sincronizarea era oprită cât timp era deconectat). Un
        // server DIFERIT (sau nicio urmă) păstrează respingerea de azi.
        if (readLastServerUrl(dirsOf(local).dataDir) === serverUrl) {
          sameServerReconnects.push({ local, serverSnapshot });
          continue;
        }
        fail(`Filiala „${local.name}” există deja pe server — poate fi doar un filiale.json copiat.`, 409);
      }
      if (isBranchEmpty(dirsOf(local).dataDir)) {
        const unclaimed = serverBranches.find(branch => !localIds.has(branch.id) && !claimedServerIds.has(branch.id));
        if (unclaimed) {
          claimedServerIds.add(unclaimed.id);
          const replaced = registry.replaceEmpty(local.id, unclaimed);
          if (replaced.id !== local.id) branchIdRemaps.push({ oldId: local.id, newId: replaced.id });
          toDownload.push({ localId: replaced.id, serverBranch: unclaimed });
          continue;
        }
      }
      toUpload.push(local);
    }

    for (const local of toUpload) {
      const dirs = dirsOf(local);
      const opened = openDatabase(dirs);
      try {
        await client.registerBranch({
          id: local.id,
          name: local.name,
          color: local.color,
          address: local.address,
          createdAt: local.createdAt,
        });
        await client.uploadSnapshot(local.id, readLocalSnapshot(opened.db, { now }));
        uploaded.push({ id: local.id, name: local.name });
      } finally {
        opened.db.close();
      }
    }

    for (const { local, serverSnapshot } of sameServerReconnects) {
      const dirs = dirsOf(local);
      const opened = openDatabase(dirs);
      try {
        backupBeforeOverwrite(opened.db, dirs.backupDir, 'inainte-reconectare');
        overwriteLocalSnapshot(opened.db, serverSnapshot);
        downloaded.push({ id: local.id, name: local.name });
      } finally {
        opened.db.close();
      }
    }

    for (const { localId, serverBranch } of toDownload) {
      const target = registry.find(localId);
      if (!target) continue;
      const opened = openDatabase(dirsOf(target));
      try {
        writeLocalSnapshot(opened.db, await client.downloadSnapshot(serverBranch.id));
        downloaded.push({ id: serverBranch.id, name: serverBranch.name });
      } finally {
        opened.db.close();
      }
    }

    // Filialele rămase pe server, neprezente local și neadoptate în locul uneia goale.
    for (const serverBranch of serverBranches) {
      if (localIds.has(serverBranch.id) || claimedServerIds.has(serverBranch.id)) continue;
      const adopted = registry.adopt(serverBranch);
      const opened = openDatabase(dirsOf(adopted));
      try {
        writeLocalSnapshot(opened.db, await client.downloadSnapshot(adopted.id));
        downloaded.push({ id: adopted.id, name: adopted.name });
      } finally {
        opened.db.close();
      }
    }

    // S-5: filiala goală adoptată mai sus (replaceEmpty) și-a schimbat id-ul — orice
    // `staff.branchIds`/`salary_payments.branchId` din setul comun care încă țin vechiul id
    // (angajați/avansuri create pe filiala implicită înainte de „Conectează”) ar rămâne
    // orfani: id-ul vechi nu mai există în niciun registru, angajatul dispare din lista
    // filialei pe AMBELE calculatoare, iar salariile lui nu se mai pot plăti. O singură
    // tranzacție (kinds.transaction) per remap, împreună cu registrul actualizat mai sus.
    if (common && branchIdRemaps.length) {
      common.kinds.transaction(() => {
        for (const { oldId, newId } of branchIdRemaps) {
          for (const staff of /** @type {{ id: string, branchIds: string[] }[]} */ (common.kinds.list('staff'))) {
            if (!Array.isArray(staff.branchIds) || !staff.branchIds.includes(oldId)) continue;
            common.kinds.save('staff', {
              ...staff,
              branchIds: staff.branchIds.map(id => (id === oldId ? newId : id)),
            });
          }
          for (const payment of /** @type {{ id: string, branchId: string }[]} */ (
            common.kinds.list('salary_payments')
          )) {
            if (payment.branchId !== oldId) continue;
            common.kinds.save('salary_payments', { ...payment, branchId: newId });
          }
        }
      });
    }

    // Setul comun (decizia 9, „Changes to the sync plan”): nu e o filială, deci nu trece prin
    // reconcilierea de mai sus. „comun” e opțional (getCommon()) doar când installul nu are
    // deloc Personal/Bazin cablate (teste izolate de reconciliere de filiale, mai vechi).
    if (common) {
      const serverSnapshot = await client.downloadSnapshot(commonDatasetId);
      const serverHasRecords = Object.values(serverSnapshot.records).some(rows => rows.length > 0);
      const { entries: localEntries } = readCommonSnapshot(common.db, { now });
      const localHasRecords = localEntries.length > 0;
      if (!serverHasRecords) {
        await client.uploadSnapshot(commonDatasetId, { entries: localEntries });
      } else if (!localHasRecords) {
        writeCommonSnapshot(common.db, serverSnapshot);
      } else {
        // S-2: amândouă au date — NU un push client-wins cu baseRevision 0 pentru tot ce e
        // local (asta suprascria mereu serverul cu copia calculatorului care se conectează
        // ULTIM, oricât de veche — cazul obișnuit, nu unul limită: departments/roles au
        // id-uri deterministe, reseminate la fiecare pornire a aplicației, deci
        // „localHasRecords” e mereu adevărat pe o instalare reală). Regula corectă (decizia
        // 9, „Changes to the sync plan”): id-urile care există deja pe server NU se ating —
        // serverul câștigă, copia locală se corectează la primul pull normal al motorului
        // (pornit imediat mai jos, la reopenActiveBranch()). Doar id-urile NOI local (create
        // înainte de connect, absente pe server) se trimit — și nu prin pushChanges direct
        // (rezultatul era aruncat, fără sync_state/conflicte) — ci prin outbox-ul comun, ca
        // motorul să le trateze applied/conflict/sync_state ca pe orice altă modificare.
        const serverRecordIds = new Set();
        for (const [kind, rows] of Object.entries(serverSnapshot.records)) {
          for (const row of rows) serverRecordIds.add(`${kind}|${row.id}`);
        }
        for (const entry of localEntries) {
          if (serverRecordIds.has(`${entry.kind}|${entry.id}`)) continue;
          common.sync.outbox.enqueue({ kind: entry.kind, recordId: entry.id, payload: entry.payload });
        }
      }
    }

    syncDevice.write({
      serverUrl,
      deviceId: paired.deviceId,
      deviceName,
      token: paired.token,
      connectedAt: now().toISOString(),
    });
    // Contextul activ poate fi cel căruia tocmai i s-au descărcat datele (calculator
    // nou) sau poate fi neschimbat (calculator care a urcat propria filială activă) —
    // recrearea lui e ieftină și corectă în ambele cazuri (motorul de sincronizare
    // pornește abia acum, când sync.json există).
    reopenActiveBranch();

    return { device: { id: paired.deviceId, name: deviceName }, uploaded, downloaded, branches: registry.list() };
  }

  function disconnect() {
    // B-4: sync.json nu e singura urmă — fiecare filială (+ setul comun) ține propriul
    // `sync_state`/`sync_conflicts`/`sync.since`/outbox. Fără curățarea lor, o reconectare
    // la un server DIFERIT ar porni cu cursoare/conflicte ale celui vechi. S-3: `serverUrl`
    // (citit ÎNAINTE de syncDevice.clear() de mai jos) se reține în fiecare bază, dincolo de
    // reset (readLastServerUrl mai sus) — connect() îl folosește ca să recunoască o
    // reconectare la ACELAȘI server (aceleași date, nu un filiale.json copiat) în loc să dea
    // 409 definitiv (B-4 rezolva doar jumătate din problemă — vezi hasLocalSyncState).
    const serverUrl = syncDevice.read()?.serverUrl;
    for (const branch of registry.list()) {
      const opened = openDatabase(dirsOf(branch));
      try {
        resetSyncState(opened.db, { serverUrl });
      } finally {
        opened.db.close();
      }
    }
    const common = getCommon();
    if (common) resetSyncState(common.db, { serverUrl });

    syncDevice.clear();
    deleteSyncDeviceFile();
    reopenActiveBranch();
    return { ok: true };
  }

  return { connect, disconnect };
}
