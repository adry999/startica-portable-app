import { fail } from '#core/server/errors/domain-error.mjs';
import { openDatabase } from '#core/server/database/sqlite-connection.mjs';
import { branchDirectories, countBranchRecords } from '#core/server/branches/branch-layout.mjs';
import { readLocalSnapshot, writeLocalSnapshot } from './snapshot-io.mjs';

/** @param {string} dataDir */
function isBranchEmpty(dataDir) {
  const counts = countBranchRecords(dataDir);
  return counts.children === 0 && counts.groups === 0;
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
        if (!isBranchEmpty(dirsOf(local).dataDir))
          fail(`Filiala „${local.name}” există deja pe server — poate fi doar un filiale.json copiat.`, 409);
        toDownload.push({ localId: local.id, serverBranch: serverMatch });
        continue;
      }
      if (isBranchEmpty(dirsOf(local).dataDir)) {
        const unclaimed = serverBranches.find(
          branch => !localIds.has(branch.id) && !claimedServerIds.has(branch.id),
        );
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
    syncDevice.clear();
    deleteSyncDeviceFile();
    reopenActiveBranch();
    return { ok: true };
  }

  return { connect, disconnect };
}
