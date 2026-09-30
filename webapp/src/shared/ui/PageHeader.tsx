import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  title: string;
  /** Comutator de mod (ex. SegmentedControl tabel/card) — opțional. */
  mode?: ReactNode;
  /** Navigator de perioadă (ex. MonthStepper) — opțional. */
  stepper?: ReactNode;
  /** Butoane secundare (ex. Exportă, Filtrează) — opțional, zero sau mai multe. */
  secondaryActions?: ReactNode;
  /** Exact un buton principal (ex. + Copil nou) — opțional (nu toate ecranele au un CTA principal). */
  primaryAction?: ReactNode;
  className?: string;
}

/** Antetul de ecran (COMPONENTE.md §0c, 28d) — titlu, apoi mod → stepper → secundare → o primară. */
export function PageHeader({ title, mode, stepper, secondaryActions, primaryAction, className }: PageHeaderProps) {
  const classes = className ? `${styles.header} ${className}` : styles.header;
  return (
    <div className={classes}>
      <h1 className={styles.title}>{title}</h1>
      {mode && <div className={styles.mode}>{mode}</div>}
      {stepper && <div className={styles.stepper}>{stepper}</div>}
      {secondaryActions && <div className={styles.secondaryActions}>{secondaryActions}</div>}
      {primaryAction && <div className={styles.primaryAction}>{primaryAction}</div>}
    </div>
  );
}
