/**
 * Persistă `lastSyncedAt` în `sync.json` (DECIZII.md punctul 55) — `sync-engine.service.mjs`
 * îl calculează deja, dar doar în memorie; la o repornire a procesului, informația dispare.
 * Un singur tracker ascultă `onStatus` de la ambele motoare ale instalării (filiala activă
 * și setul comun — decizia 9), ca „ultima sincronizare” să reflecte oricare dintre ele.
 * Citește `syncDevice.read()` proaspăt la fiecare apel, nu o copie închisă la construcție:
 * dacă dispozitivul a fost deconectat între timp (Faza 5, `clear()`), nu mai scrie nimic.
 * @param {{ syncDevice: import('../sync.types.d.mts').SyncDeviceRepository }} dependencies
 */
export function createLastSyncedAtTracker({ syncDevice }) {
  /** @param {{ lastSyncedAt?: string }} status */
  function handleStatus(status) {
    if (!status.lastSyncedAt) return;
    const current = syncDevice.read();
    if (!current) return;
    if (current.lastSyncedAt === status.lastSyncedAt) return;
    syncDevice.write({ ...current, lastSyncedAt: status.lastSyncedAt });
  }

  return { handleStatus };
}
