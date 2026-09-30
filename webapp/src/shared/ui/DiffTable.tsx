import type { ReactNode } from 'react';
import styles from './DiffTable.module.css';

export interface DiffTableColumn {
  key: 'local' | 'remote';
  label: ReactNode;
}

export interface DiffTableRow {
  key: string;
  label: string;
  local: ReactNode;
  remote: ReactNode;
  differs: boolean;
}

export interface DiffTableProps {
  columns: DiffTableColumn[];
  rows: DiffTableRow[];
  note?: ReactNode;
  className?: string;
}

/** Comparație doar-citire local/de la distanță (Conflicte) — generalizată din ConflictDetail. */
export function DiffTable({ columns, rows, note, className }: DiffTableProps) {
  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <div className={styles.table}>
        <div className={styles.head}>
          <span />
          {columns.map(column => (
            <span key={column.key}>{column.label}</span>
          ))}
        </div>
        {rows.map(row => (
          <div key={row.key} className={row.differs ? `${styles.row} ${styles.rowDiffers}` : styles.row}>
            <span className={styles.fieldName}>{row.label}</span>
            <span>{row.local}</span>
            <span>{row.remote}</span>
          </div>
        ))}
      </div>
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}
