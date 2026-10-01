import type { ReactNode } from 'react';
import styles from './MasterDetail.module.css';

export interface MasterDetailProps {
  master: ReactNode;
  detail: ReactNode;
  /** Lățimea panoului listă. Ignorată dacă `detailWidth` e dat (lista devine cea flexibilă). Implicit 360. */
  masterWidth?: number;
  /** Panoul de detaliu are lățime fixă, iar lista umple tot ce rămâne — pentru liste late cu
   * detaliu îngust (Achitări „Pe luni”). Implicit necompletat: lista are lățime fixă, detaliul umple restul. */
  detailWidth?: number;
  /** Pe ce parte stă panoul de detaliu. Implicit 'end' (dreapta). */
  detailSide?: 'start' | 'end';
  className?: string;
}

/**
 * Layout cu două panouri — listă + detaliu, fiecare cu scroll propriu (31b). Doar structura
 * vizuală: selecția, randarea listei și colapsul la lățime mică rămân în grija apelantului.
 */
export function MasterDetail({
  master,
  detail,
  masterWidth = 360,
  detailWidth,
  detailSide = 'end',
  className,
}: MasterDetailProps) {
  const classes = className ? `${styles.root} ${className}` : styles.root;

  const masterPane = (
    <div className={styles.master} style={detailWidth ? { flex: 1, width: 'auto' } : { width: masterWidth }}>
      {master}
    </div>
  );
  const detailPane = (
    <div className={styles.detail} style={detailWidth ? { flex: 'none', width: detailWidth } : undefined}>
      {detail}
    </div>
  );

  return (
    <div className={classes}>
      {detailSide === 'start' ? detailPane : masterPane}
      {detailSide === 'start' ? masterPane : detailPane}
    </div>
  );
}
