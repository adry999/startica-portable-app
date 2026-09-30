import type { ReactNode } from 'react';
import styles from './FormGrid.module.css';

export interface FormGridProps {
  /** Câte coloane implicit (desktop) — 1 sau 2. Implicit 2. */
  columns?: 1 | 2;
  children: ReactNode;
  className?: string;
}

/** Grilă responzivă pentru câmpuri de formular — 2 coloane pe desktop, 1 pe ecran îngust (DS-IMPLEMENTARE.md §3). */
export function FormGrid({ columns = 2, children, className }: FormGridProps) {
  const gridClassName = columns === 1 ? styles.oneColumn : styles.twoColumns;
  return (
    <div className={className ? `${styles.grid} ${gridClassName} ${className}` : `${styles.grid} ${gridClassName}`}>
      {children}
    </div>
  );
}
