import type { SyncCardMode } from './sync-status';
import styles from './SyncStatusCard.module.css';

export interface SyncStatusCardProps {
  mode: SyncCardMode;
  label: string;
  detail: string;
  /** Prezent doar la conflict (Rezolvă) și revoked (Reconectează din Backup și setări). */
  actionLabel?: string;
  onAction?: () => void;
}

// „revoked” arată exact ca „offline” (decizia din 2026-09-27-sincronizare.md, Task 8:
// a cincea stare, cu un text separat, pe același stil galben din spec).
const MODE_CLASS: Record<SyncCardMode, string | undefined> = {
  synced: undefined,
  syncing: styles.syncing,
  offline: styles.offline,
  revoked: styles.offline,
  conflict: styles.conflict,
};

/** Înlocuiește SaveStatusCard în sidebar (14a) când sincronizarea e configurată. */
export function SyncStatusCard({ mode, label, detail, actionLabel, onAction }: SyncStatusCardProps) {
  const modeClass = MODE_CLASS[mode];
  return (
    <div className={modeClass ? `${styles.card} ${modeClass}` : styles.card} data-state={mode} role="status">
      <div className={styles.row}>
        <span className={styles.dot} aria-hidden="true" />
        <strong className={styles.label}>{label}</strong>
      </div>
      {detail && (
        <div className={styles.detailRow}>
          <small>{detail}</small>
          {actionLabel && onAction && (
            <button type="button" className={styles.action} onClick={onAction}>
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
