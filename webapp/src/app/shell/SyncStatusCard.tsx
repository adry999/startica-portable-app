import type { SyncCardMode } from './sync-status';
import styles from './SyncStatusCard.module.css';

export interface SyncStatusCardProps {
  mode: SyncCardMode;
  label: string;
  detail: string;
  /** Prezent doar la conflict (Rezolvă) și revoked (Reconectează din Backup și setări). */
  actionLabel?: string;
  onAction?: () => void;
  /** „Click pe card deschide 14b” (18-sincronizare.md §14a) — indiferent de stare. */
  onCardClick?: () => void;
}

// „revoked” arată exact ca „offline” (decizia din 2026-09-27-sincronizare.md, Task 8:
// a cincea stare, cu un text separat, pe același stil galben din spec).
const MODE_CLASS: Record<SyncCardMode, string | undefined> = {
  synced: undefined,
  syncing: styles.syncing,
  offline: styles.offline,
  revoked: styles.offline,
  // §5.2 (426): la fel ca „revoked” — oprit, niciun pending job nu-l schimbă singur.
  incompatible: styles.offline,
  conflict: styles.conflict,
};

/** Înlocuiește SaveStatusCard în sidebar (14a) când sincronizarea e configurată. */
export function SyncStatusCard({ mode, label, detail, actionLabel, onAction, onCardClick }: SyncStatusCardProps) {
  const modeClass = MODE_CLASS[mode];
  const hasOwnAction = !!(actionLabel && onAction);
  // Cardul devine el însuși un buton (rol + tastatură) doar când nu conține deja un
  // buton propriu (Rezolvă/Reconectează) — un rol interactiv nu se cuibărește în altul.
  const cardIsInteractive = !!onCardClick && !hasOwnAction;
  return (
    <div
      className={[styles.card, onCardClick ? styles.clickable : '', modeClass ?? ''].filter(Boolean).join(' ')}
      data-state={mode}
      role={cardIsInteractive ? 'button' : 'status'}
      tabIndex={cardIsInteractive ? 0 : undefined}
      onClick={onCardClick}
      onKeyDown={
        cardIsInteractive
          ? event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onCardClick?.();
              }
            }
          : undefined
      }
    >
      <div className={styles.row}>
        <span className={styles.dot} aria-hidden="true" />
        <strong className={styles.label}>{label}</strong>
      </div>
      {detail && (
        <div className={styles.detailRow}>
          <small>{detail}</small>
          {actionLabel && onAction && (
            <button
              type="button"
              className={styles.action}
              onClick={event => {
                event.stopPropagation();
                onAction();
              }}
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
