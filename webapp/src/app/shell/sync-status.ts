import type { SyncStatus } from '@shared/api/useSyncStatus';
import type { SessionStateForSaveStatus } from './save-status';

export type SyncCardMode = 'synced' | 'syncing' | 'offline' | 'conflict' | 'revoked';

export interface SyncCardResult {
  mode: SyncCardMode;
  label: string;
  detail: string;
  actionLabel?: string;
}

function formatSyncedAt(iso: string): string {
  if (!iso) return 'Sincronizat';
  return `Sincronizat · ${new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
}

function pendingLabel(count: number): string {
  return `${count} ${count === 1 ? 'modificare salvată' : 'modificări salvate'}`;
}

/**
 * Cele 4 stări din spec (`18-sincronizare.md` §14a) plus „revoked" (a 5-a, deviație
 * notată în commit — același stil galben ca „Fără internet”, alt text). Ordinea de
 * prioritate e cea din spec: conflict > deconectat > fără internet > se sincronizează
 * > sincronizat (criteriul „Cardul din meniu arată corect cele 4 stări”).
 *
 * `null` = erorile locale (salvare, conexiune, backup) au întâietate — apelantul
 * (Sidebar) arată SaveStatusCard ca astăzi, nu acest card.
 */
export function deriveSyncStatus(sync: SyncStatus, local: SessionStateForSaveStatus): SyncCardResult | null {
  const hasLocalError = !!(
    local.saveError ||
    local.connectionError ||
    local.health.localError ||
    local.health.externalError
  );
  if (hasLocalError) return null;

  if (sync.conflicts > 0)
    return {
      mode: 'conflict',
      label: `${sync.conflicts} ${sync.conflicts === 1 ? 'conflict' : 'conflicte'}`,
      detail: 'Aceleași date modificate pe alt calculator.',
      actionLabel: 'Rezolvă',
    };

  if (sync.connection === 'revoked')
    return {
      mode: 'revoked',
      label: 'Deconectat de pe server',
      detail: 'Acest calculator nu mai trimite sau primește date.',
      actionLabel: 'Reconectează din Backup și setări',
    };

  if (sync.connection === 'offline')
    return {
      mode: 'offline',
      label: 'Fără internet',
      detail: `${pendingLabel(sync.pending)} local. Se trimit automat când revine conexiunea.`,
    };

  if (sync.pushing || sync.pending > 0)
    return {
      mode: 'syncing',
      label: `Se trimit ${sync.pending} modificări…`,
      detail: 'Poți lucra în continuare',
    };

  return {
    mode: 'synced',
    label: formatSyncedAt(sync.lastSyncedAt),
    detail: 'Toate calculatoarele au aceleași date',
  };
}
