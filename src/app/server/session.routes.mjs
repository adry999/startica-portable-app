import os from 'node:os';
import { fail } from '#core/server/errors/domain-error.mjs';
import { sendResponse } from '#core/server/http/json-response.mjs';
import { RESPONSE_SENT } from '#core/server/http/route-dispatcher.mjs';
import { completProfile, normalizeProfile } from '#shared/domain/computer-profile.mjs';

/**
 * @param {{
 *   sessionToken: string,
 *   version: string,
 *   readEnvelope: () => unknown,
 *   backupService: { cancelScheduledBackup: () => void, safeBackup: (reason: string) => { warning?: string } },
 *   commonBackupService?: { cancelScheduledBackup: () => void, safeBackup: (reason: string) => { warning?: string } },
 *   allowShutdown: boolean,
 *   shutdown: () => void,
 *   branch: import('#core/server/branches/branch-registry.mjs').BranchEntry,
 *   listBranches: () => import('#core/server/branches/branch-registry.mjs').BranchEntry[],
 *   syncDevice?: { read: () => import('#features/sync/index.server.mjs').SyncDeviceFile | null },
 *   poolEnabled?: () => boolean,
 *   updateStatus?: () => import('./update-check.service.mjs').UpdateStatus,
 * }} dependencies
 */
export function createSessionRoutes({
  sessionToken,
  version,
  readEnvelope,
  backupService,
  // Baza comună (Personal 24, E-1 din audit): oprirea din lansator e singura cale reală
  // de închidere (main.mjs face propriul backup separat, la SIGINT/SIGTERM) — Comun\
  // (salarii, avansuri, pontaj) trebuie să aibă și ea o copie la acest moment, nu doar
  // filiala activă. Opțional — un context fără el (teste izolate de filială) nu-l are.
  commonBackupService = { cancelScheduledBackup: () => {}, safeBackup: () => ({}) },
  allowShutdown,
  shutdown,
  branch,
  listBranches,
  // Neconfigurat implicit — un context construit fără el (teste izolate) vede sync: null.
  syncDevice = { read: () => null },
  // Bazin (23, decizia 10): Sidebar ascunde „Bazin” cât timp filiala nu l-a configurat.
  poolEnabled = () => false,
  // §5.2: un context fără verificare de actualizare (teste izolate) vede „nicio verificare
  // încă”, nu o eroare — vezi createUpdateChecker din update-check.service.mjs.
  updateStatus = () => ({
    updateAvailable: false,
    currentVersion: version,
    latestVersion: version,
    releaseUrl: null,
    downloadUrl: null,
    sha256: null,
    notes: null,
    checkedAt: null,
    error: null,
  }),
  // 46a (PROMPT-9 §4): „fără date” pe filiala activă — StartSourceScreen îl folosește ca
  // să decidă dacă arată alegerea Backup/Sincronizare/De la zero, în loc de restul aplicației.
  // Implicit `true` (un context fără verificare, ex. teste izolate, nu arată niciodată ecranul).
  hasAnyData = () => true,
}) {
  let closing = false;
  // Ecranul de pornire (21a) arată pasul „Sincronizez cu serverul comun” doar când
  // sync.json există; adresa și numele de dispozitiv vin de aici, nu din /api/sync/status,
  // ca sesiunea să știe imediat dacă are rost să mai ceară acel status.
  function syncSummary() {
    const device = syncDevice.read();
    if (device)
      return {
        configured: true,
        deviceName: device.deviceName,
        serverUrl: device.serverUrl,
        lastSyncedAt: device.lastSyncedAt ?? '',
      };
    // Task 12 (fila Sincronizare): numele dispozitivului la conectare vine prefil de aici,
    // ca utilizatorul să nu tasteze numele calculatorului de la zero.
    return { configured: false, suggestedName: os.hostname() };
  }
  // §5.3 (36d/36f): un calculator fără sync.json (instalare neconectată, sau un motor care
  // n-a mai apucat niciun ciclu de sincronizare) nu are restricții — doar un calculator
  // conectat la un server cu profiluri active le primește efectiv.
  function currentProfile() {
    const stored = syncDevice.read()?.profile;
    // Normalizat la citire (nu doar la scriere din sync-engine): un sync.json editat manual,
    // vechi, sau scris de o versiune anterioară a profilului nu trebuie să lipsească module
    // din formă sau să lase `admin` ridicat pe un preset care nu e Complet.
    return stored ? normalizeProfile(stored) : completProfile();
  }

  return [
    {
      method: 'GET',
      path: '/api/session',
      handle: () => ({
        token: sessionToken,
        version,
        branch,
        branches: listBranches(),
        sync: syncSummary(),
        pool: { enabled: poolEnabled() },
        // §5.2: sursa pentru AppBanner „Actualizare gata” (§11, 42a/42b) — construit aici,
        // UI-ul rămâne de făcut separat.
        update: updateStatus(),
        // §5.3: profilul acestui calculator — meniul, rutele (ModuleGuard) și gărzile /api
        // locale se construiesc din el (31-profiluri-calculator.md).
        profile: currentProfile(),
        hasAnyData: hasAnyData(),
      }),
    },
    { method: 'GET', path: '/api/state', handle: () => readEnvelope() },
    {
      method: 'POST',
      path: '/api/shutdown',
      /** @param {{ response: import('node:http').ServerResponse }} request */
      handle: ({ response }) => {
        if (!allowShutdown) fail('Operațiune inexistentă.', 404);
        // Al doilea apel (două lansatoare, două ferestre) nu face al doilea backup și nu închide baza de două ori.
        if (closing) {
          sendResponse(response, { ok: true, warning: '' });
          return RESPONSE_SENT;
        }
        closing = true;
        backupService.cancelScheduledBackup();
        commonBackupService.cancelScheduledBackup();
        const commonResult = commonBackupService.safeBackup('inchidere');
        const result = backupService.safeBackup('inchidere');
        const warning = [commonResult.warning, result.warning].filter(Boolean).join(' ');
        sendResponse(response, { ok: true, warning });
        shutdown();
        return RESPONSE_SENT;
      },
    },
    // Ruta de scriere a versiunii vechi. Un mesaj explicit este mai util decât 404.
    { method: 'POST', path: '/api/state', handle: () => fail('Această versiune este veche. Reîncarcă pagina.', 409) },
  ];
}
