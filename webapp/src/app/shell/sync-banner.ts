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
export function deriveSyncBanner(sync: SyncStatus): SyncBanner | null {
  if (sync.connection === 'revoked')
    return {
      message: `Sincronizare oprită — acest calculator nu mai trimite sau primește date. ${changesLabel(sync.pending)}.`,
      actionLabel: 'Reconectează',
    };
  if (sync.connection === 'offline')
    return {
      message: `Sincronizare oprită — fără internet. ${changesLabel(sync.pending)}, se trimit automat când revine conexiunea.`,
    };
  return null;
}
