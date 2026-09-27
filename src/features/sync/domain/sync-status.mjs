/** Cele 4+1 stări posibile ale cardului 14a (decizia 10 din plan). */
export const SYNC_MODES = ['conflict', 'revoked', 'offline', 'syncing', 'synced'];

/**
 * Starea cardului din josul meniului, derivată pur din obiectul de stare al
 * motorului de sincronizare (`GET /api/sync/status`, Faza 3) — nicio dependență
 * de rețea sau de bază aici, ca regula de prioritate să fie testabilă singură.
 * Ordinea e cea din spec (18-sincronizare.md §14a): conflict > deconectat >
 * fără internet > se sincronizează > sincronizat.
 * @param {{ conflicts: number, connection: 'online' | 'offline' | 'revoked', pending: number, pushing: boolean }} status
 * @returns {{ mode: 'conflict' | 'revoked' | 'offline' | 'syncing' | 'synced' }}
 */
export function deriveSyncMode(status) {
  if (status.conflicts > 0) return { mode: 'conflict' };
  if (status.connection === 'revoked') return { mode: 'revoked' };
  if (status.connection === 'offline') return { mode: 'offline' };
  if (status.pushing || status.pending > 0) return { mode: 'syncing' };
  return { mode: 'synced' };
}
