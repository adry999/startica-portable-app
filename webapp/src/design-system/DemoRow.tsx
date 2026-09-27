import type { ReactNode } from 'react';
import styles from './DemoRow.module.css';

export interface DemoRowProps {
  label: string;
  children: ReactNode;
}

/** Rând „etichetă · exemplu” — pentru a înșira variantele unei componente unele sub altele. */
export function DemoRow({ label, children }: DemoRowProps) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.sample}>{children}</div>
    </div>
  );
}
