import type { SyncCardMode } from './sync-status';
import styles from './SyncStatusPill.module.css';

export interface SyncStatusPillProps {
  mode: SyncCardMode;
  /** Același text ca în cardul din sidebar (14a) — „arată aceeași stare” (§11, 42a/42b). */
  label: string;
  onClick?: () => void;
}

// „revoked”/„offline” = sincronizare oprită (roz, ca banda 42a); „conflict” la fel (roz, cere
// atenție); „syncing” = în curs (galben, ca la cardul din sidebar); „synced” = mint.
const MODE_CLASS: Record<SyncCardMode, string> = {
  synced: styles.synced,
  syncing: styles.syncing,
  offline: styles.stopped,
  revoked: styles.stopped,
  incompatible: styles.stopped,
  conflict: styles.stopped,
};

/** Pastila din antet (§11, 42a/42b: „Pastila de sincronizare din antet arată aceeași stare” ca
 * banda/cardul din sidebar) — vizibilă pe toate ecranele cât timp sincronizarea e configurată.
 * Același tipar de accesibilitate ca `SyncStatusCard` (sidebar): rol/tastatură doar când e dat
 * `onClick`, altfel rămâne un simplu indicator (`role="status"`). */
export function SyncStatusPill({ mode, label, onClick }: SyncStatusPillProps) {
  const classes = [styles.pill, MODE_CLASS[mode], onClick ? styles.clickable : ''].filter(Boolean).join(' ');
  return (
    <div
      className={classes}
      role={onClick ? 'button' : 'status'}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </div>
  );
}
