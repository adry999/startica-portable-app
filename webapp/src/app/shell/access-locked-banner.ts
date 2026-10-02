import type { AccessRowView } from '@shared/audit-log';

type ComputerProfile = import('#shared/domain/computer-profile.mjs').ComputerProfile;

/** Cheia din localStorage pentru ultima intrare `access.locked` văzută (§5, punctul 3,
 * PROMPT-CLAUDE-CODE-10) — același tipar ca `UPDATE_DISMISS_KEY` (update-banner.ts): un
 * marcaj text simplu, implicit gol (nimic văzut încă). */
export const ACCESS_LOCKED_SEEN_KEY = 'appBanner.accessLocked.lastSeenEntryId';

export interface AccessLockedBanner {
  message: string;
  /** Id-ul intrării `access.locked` arătate — de scris în localStorage la închidere (×). */
  entryId: string;
}

/**
 * Bara mint „Calculator blocat” (§5, punctul 3 — docs/design/screens/31-profiluri-calculator.md,
 * „Istoric pe calculatoare”): odată ce o intrare `access.locked` (5 PIN-uri greșite pe un alt
 * calculator) ajunge aici prin sincronizarea normală (pull, polling — fără canal live/push,
 * confirmat în afara domeniului de INTREBARI.md), un calculator cu profil Complet arată un
 * banner dismisibil. Nu reapare după închidere pentru ACEEAȘI intrare (marcaj `entryId`,
 * ca `dismissedUntil` la actualizare) — o intrare `access.locked` ULTERIOARĂ (alt calculator,
 * sau din nou același) are alt id, deci reapare.
 *
 * `rows` vin din `useAccessLog()` (aceeași sursă ca fila „Acces”, 36g — fără cerere nouă către
 * server), ordonate cele mai noi primele, ca `readPage` pe server — `rows.find` ia direct cea
 * mai recentă intrare `access.locked`, nu toate.
 *
 * @param rows rândurile curente ale filei „Acces” (`useAccessLog().rows`)
 * @param profile profilul acestui calculator (`session.state.profile`) — `null`/`undefined`
 *   tratat ca Complet în restul aplicației (`completProfile()`), dar AICI banner-ul nu arată
 *   nimic fără un profil confirmat (gol până la primul `/api/session`, nu „arată implicit”).
 * @param lastSeenEntryId valoarea persistată (string, `''` = nimic văzut încă)
 */
export function deriveAccessLockedBanner(
  rows: AccessRowView[],
  profile: ComputerProfile | null | undefined,
  lastSeenEntryId: string,
): AccessLockedBanner | null {
  if (!profile || profile.preset !== 'complet') return null;
  const latest = rows.find(row => row.action === 'access.locked');
  if (!latest) return null;
  const entryId = String(latest.id);
  if (entryId === lastSeenEntryId) return null;
  return { entryId, message: `Calculatorul „${latest.deviceName}” a fost blocat după 5 PIN-uri greșite.` };
}
