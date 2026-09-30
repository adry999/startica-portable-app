import type { ReactNode } from 'react';
import styles from './PrintHeader.module.css';

export interface PrintHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Bloc din dreapta — de regulă identitatea grădiniței (nume, IDNO). */
  aside?: ReactNode;
  className?: string;
}

/** Antetul unei tipărituri A4 (32f, COMPONENTE.md §0g) — titlu/subtitlu la stânga, identitate la dreapta. */
export function PrintHeader({ title, subtitle, aside, className }: PrintHeaderProps) {
  const classes = className ? `${styles.header} ${className}` : styles.header;
  return (
    <div className={classes}>
      <div className={styles.titleBlock}>
        <p className={styles.title}>{title}</p>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {aside && <div className={styles.aside}>{aside}</div>}
    </div>
  );
}
