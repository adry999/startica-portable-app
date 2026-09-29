import { randomUUID } from 'node:crypto';
import { fail } from '#core/server/errors/domain-error.mjs';
import { openDatabase, openDatabaseReadOnly } from '#core/server/database/sqlite-connection.mjs';
import { branchDirectories, countBranchRecords } from '#core/server/branches/branch-layout.mjs';
import { readLocalSnapshot, writeLocalSnapshot, readCommonSnapshot, writeCommonSnapshot } from './snapshot-io.mjs';

// B-4: aceeași cheie ca sync-engine.service.mjs/snapshot-io.mjs — nu importată de acolo
// (fiecare modul o repetă local) ca să nu lege connect-ul de motor doar pentru o constantă.
const SYNC_SINCE_SETTING = 'sync.since';

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
 * B-4: golește starea de sincronizare a unei baze (filială sau setul comun) — apelată la
 * `disconnect()`. Rândurile din outbox NU se șterg (editările netrimise nu trebuie
 * pierdute), se arhivează, ca să nu mai plece la o viitoare conectare cu o revizie de bază
 * care n-are ce să mai însemne pe un server nou (sau același, reconectat de la zero).
 * @param {import('node:sqlite').DatabaseSync} db
 */
function resetSyncState(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
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
 *   getCommon?: () => { db: import('node:sqlite').DatabaseSync, kinds: { list: (kind: string) => { id: string }[] } } | undefined,
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
    const { branches: serverBranches } = await client.listBranches();
    const localBranches = registry.list();
    const localIds = new Set(localBranches.map(branch => branch.id));
    const claimedServerIds = new Set();

    /** @type {{ id: string, name: string }[]} */
    const uploaded = [];
    /** @type {{ id: string, name: string }[]} */
    const downloaded = [];
    /** @type {{ localId: string, serverBranch: { id: string, name: string, color: string, address: string, createdAt: string } }[]} */
    const toDownload = [];
    /** @type {import('#core/server/branches/branch-registry.mjs').BranchEntry[]} */
    const toUpload = [];

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
        fail(`Filiala „${local.name}” există deja pe server — poate fi doar un filiale.json copiat.`, 409);
      }
      if (isBranchEmpty(dirsOf(local).dataDir)) {
        const unclaimed = serverBranches.find(branch => !localIds.has(branch.id) && !claimedServerIds.has(branch.id));
        if (unclaimed) {
          claimedServerIds.add(unclaimed.id);
          const replaced = registry.replaceEmpty(local.id, unclaimed);
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

    // Setul comun (decizia 9, „Changes to the sync plan”): nu e o filială, deci nu trece prin
    // reconcilierea de mai sus. „comun” e opțional (getCommon()) doar când installul nu are
    // deloc Personal/Bazin cablate (teste izolate de reconciliere de filiale, mai vechi).
    const common = getCommon();
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
        // Amândouă au date (decizia 9): nu 409 — rândurile locale se urcă drept modificări
        // obișnuite, cu baseRevision 0. Id-urile noi se aplică; cele care coincid urmează
        // politica kind-ului (LWW pentru majoritate, conflict pentru „staff”, o fișă).
        if (localEntries.length) {
          await client.pushChanges(
            commonDatasetId,
            localEntries.map(entry => ({
              changeId: randomUUID(),
              kind: entry.kind,
              recordId: entry.id,
              baseRevision: 0,
              payload: entry.payload,
              changedAt: entry.updatedAt,
            })),
          );
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
    // la ACELAȘI server dă 409 pe fiecare filială nevidă (hasLocalSyncState rămâne
    // adevărat), iar una la un server DIFERIT pornește cu cursoare/conflicte ale celui vechi.
    for (const branch of registry.list()) {
      const opened = openDatabase(dirsOf(branch));
      try {
        resetSyncState(opened.db);
      } finally {
        opened.db.close();
      }
    }
    const common = getCommon();
    if (common) resetSyncState(common.db);

    syncDevice.clear();
    deleteSyncDeviceFile();
    reopenActiveBranch();
    return { ok: true };
  }

  return { connect, disconnect };
}
