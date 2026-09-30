import type { ReactNode } from 'react';
import { formatDateTime } from '#shared/format/date-format.mjs';
import styles from './PrintFooter.module.css';

export interface PrintFooterProps {
  children: ReactNode;
  /** ISO — implicit momentul randării. */
  printedAt?: string;
  className?: string;
}

/** Subsolul unei tipărituri A4 (32f, COMPONENTE.md §0g) — notă la stânga, „tipărit la…” la dreapta. */
export function PrintFooter({ children, printedAt, className }: PrintFooterProps) {
  const classes = className ? `${styles.footer} ${className}` : styles.footer;
  return (
    <div className={classes}>
      <span>{children}</span>
      <span>tipărit la {formatDateTime(printedAt ?? new Date().toISOString())}</span>
    </div>
  );
}
