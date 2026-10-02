import type { SyncStatus } from '@shared/api/useSyncStatus';

export interface SyncBanner {
  message: string;
  /** Prezent doar pentru „revoked” — reconectarea e singura acțiune posibilă. „offline” nu are
   * acțiune: nimic de apăsat, revine singur când apare internetul. */
  actionLabel?: string;
}

function changesLabel(count: number): string {
  return `${count} ${count === 1 ? 'modificare nesincronizată' : 'modificări nesincronizate'}`;
}

/**
 * Banda roz „Sincronizare oprită” (§11, 42a) — deasupra antetului, pe toate rutele, fără ×
 * (nu se poate închide cât sincronizarea chiar nu merge). Apare doar când sincronizarea e
 * configurată și conexiunea e „offline” sau „revoked” — nu și la „conflict”, care are deja
 * propriul flux (cardul din sidebar + „Rezolvă” → /conflicte), nici la „syncing” (trimite în
 * mod normal, nu e o stare de oprire).
 */
/**
 * @param sync starea de sincronizare (useSyncStatus)
 * @param currentVersion versiunea aplicației curente (`session.state.version`) — doar pentru
 *   textul „incompatible” (426, SYNC_MIN_CLIENT_VERSION); celelalte cauze n-o folosesc.
 */
export function deriveSyncBanner(sync: SyncStatus, currentVersion?: string): SyncBanner | null {
  if (sync.connection === 'revoked')
    return {
      message: `Sincronizare oprită — acest calculator nu mai trimite sau primește date. ${changesLabel(sync.pending)}.`,
      actionLabel: 'Reconectează',
    };
  // §5.2 (37a/37c, INTREBARI.md „Condiția exactă «versiune prea veche»”): a treia cauză de
  // blocare, fără acțiune (ca „offline” — reconectarea nu rezolvă nimic, trebuie o actualizare).
  if (sync.connection === 'incompatible')
    return {
      message: `Sincronizare oprită — versiunea ${currentVersion ?? ''} e prea veche, actualizează la ${sync.minVersion}.`,
    };
  if (sync.connection === 'offline')
    return {
      message: `Sincronizare oprită — fără internet. ${changesLabel(sync.pending)}, se trimit automat când revine conexiunea.`,
    };
  return null;
}
