import type { ReactNode } from 'react';
import styles from './TableFooter.module.css';

export interface TableFooterProps {
  /** Ex. "24 de rezultate" — apelantul formatează textul (plural/singular etc.), TableFooter doar îl arată. */
  summary: string;
  /** Sloț opțional, de obicei un `<Pagination>`. */
  pagination?: ReactNode;
  className?: string;
}

/** Subsol standard sub un tabel — total/rezumat la stânga, paginare la dreapta (dacă e dată). */
export function TableFooter({ summary, pagination, className }: TableFooterProps) {
  const classes = className ? `${styles.footer} ${className}` : styles.footer;

  return (
    <div className={classes}>
      <span className={styles.summary}>{summary}</span>
      {pagination && <div className={styles.pagination}>{pagination}</div>}
    </div>
  );
}
