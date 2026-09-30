import type { ReactNode } from 'react';
import styles from './MasterDetail.module.css';

export interface MasterDetailProps {
  master: ReactNode;
  detail: ReactNode;
  /** Lățimea panoului stâng. Implicit 360. */
  masterWidth?: number;
  className?: string;
}

/**
 * Layout cu două panouri — listă (stânga, scroll propriu) + detaliu (dreapta, restul lățimii).
 * Doar structura vizuală (31b): selecția, randarea listei și colapsul la lățime mică rămân în
 * grija apelantului.
 */
export function MasterDetail({ master, detail, masterWidth = 360, className }: MasterDetailProps) {
  const classes = className ? `${styles.root} ${className}` : styles.root;
  return (
    <div className={classes}>
      <div className={styles.master} style={{ width: masterWidth }}>
        {master}
      </div>
      <div className={styles.detail}>{detail}</div>
    </div>
  );
}
