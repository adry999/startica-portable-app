import styles from './LoadingBar.module.css';

export interface LoadingBarProps {
  /** 0–100. */
  percent: number;
  /** Eticheta pasului curent, ex. „Citesc baza de date…” / „Gata”. */
  stepLabel: string;
  className?: string;
}

/** Bară de progres cu rândul de sub ea — pas curent la stânga, procent la dreapta (21a, ALINIERE-DESIGN.md A8). */
export function LoadingBar({ percent, stepLabel, className }: LoadingBarProps) {
  const classes = className ? `${styles.group} ${className}` : styles.group;
  const pct = Math.round(percent);
  return (
    <div className={classes}>
      <div className={styles.track}>
        <span className={styles.bar} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.meta}>
        <span className={styles.stepLabel}>{stepLabel}</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}
