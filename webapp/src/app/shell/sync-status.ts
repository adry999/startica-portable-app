import type { SyncStatus } from '@shared/api/useSyncStatus';
import { PRESET_LABELS } from '#shared/domain/computer-profile.mjs';
import type { SessionStateForSaveStatus } from './save-status';

export type SyncCardMode = 'synced' | 'syncing' | 'offline' | 'conflict' | 'revoked' | 'incompatible';

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

/** §5.3 (36d): „Profil X · acces limitat” — doar pentru un profil restrâns, nu pentru Complet.
 * Un profil blocat arată „Acces blocat”, mai grav decât o simplă restrângere. */
function profileNote(profile?: import('#shared/domain/computer-profile.mjs').ComputerProfile | null): string | null {
  if (!profile) return null;
  if (profile.blocked) return 'Acces blocat';
  if (profile.preset === 'complet') return null;
  const presetLabels: Record<string, string> = PRESET_LABELS;
  return `Profil ${presetLabels[profile.preset] ?? profile.preset} · acces limitat`;
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
export function deriveSyncStatus(
  sync: SyncStatus,
  local: SessionStateForSaveStatus,
  profile?: import('#shared/domain/computer-profile.mjs').ComputerProfile | null,
  /** §5.2 (426, 37a/37c): versiunea aplicației curente — doar pentru textul „incompatible”. */
  currentVersion?: string,
): SyncCardResult | null {
  const hasLocalError = !!(
    local.saveError ||
    local.connectionError ||
    local.health.localError ||
    local.health.externalError
  );
  if (hasLocalError) return null;

  const note = profileNote(profile);
  // §5.3 (36d): pe „sincronizat”, nota de profil înlocuiește detaliul generic („Toate
  // calculatoarele au aceleași date” ar fi chiar greșit pe un profil restrâns — acest
  // calculator NU are toate datele). Pe celelalte stări, detaliul tehnic rămâne cel mai util
  // (offline/conflict/revoked), nota de profil se adaugă la coadă, nu îl înlocuiește.
  function withNote(mode: SyncCardResult['mode'], detail: string): string {
    if (!note) return detail;
    return mode === 'synced' ? note : `${detail} · ${note}`;
  }

  if (sync.conflicts > 0)
    return {
      mode: 'conflict',
      label: `${sync.conflicts} ${sync.conflicts === 1 ? 'conflict' : 'conflicte'}`,
      detail: withNote('conflict', 'Aceleași date modificate pe alt calculator.'),
      actionLabel: 'Rezolvă',
    };

  if (sync.connection === 'revoked')
    return {
      mode: 'revoked',
      label: 'Deconectat de pe server',
      detail: withNote('revoked', 'Acest calculator nu mai trimite sau primește date.'),
      actionLabel: 'Reconectează din Backup și setări',
    };

  if (sync.connection === 'incompatible')
    return {
      mode: 'incompatible',
      label: 'Versiune prea veche',
      detail: withNote(
        'incompatible',
        `Versiunea ${currentVersion ?? ''} e prea veche, actualizează la ${sync.minVersion}.`,
      ),
    };

  if (sync.connection === 'offline')
    return {
      mode: 'offline',
      label: 'Fără internet',
      detail: withNote('offline', `${pendingLabel(sync.pending)} local. Se trimit automat când revine conexiunea.`),
    };

  if (sync.pushing || sync.pending > 0)
    return {
      mode: 'syncing',
      label: `Se trimit ${sync.pending} modificări…`,
      detail: withNote('syncing', 'Poți lucra în continuare'),
    };

  return {
    mode: 'synced',
    label: formatSyncedAt(sync.lastSyncedAt),
    detail: withNote('synced', 'Toate calculatoarele au aceleași date'),
  };
}
