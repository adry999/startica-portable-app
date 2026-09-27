import styles from './BranchSwitchOverlay.module.css';

export interface BranchSwitchOverlayProps {
  toName: string;
}

/** Suprapunerea de comutare (13a) — peste zona de lucru, cât timp filiala nouă se deschide. */
export function BranchSwitchOverlay({ toName }: BranchSwitchOverlayProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <span className={styles.dot} aria-hidden="true" />
        Se deschide {toName}…
      </div>
    </div>
  );
}
