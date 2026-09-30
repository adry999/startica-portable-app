import type { ReactNode } from 'react';
import styles from './PrintTable.module.css';

export interface PrintTableColumn<Row> {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  align?: 'start' | 'end';
}

export interface PrintTableProps<Row> {
  columns: PrintTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  rowClassName?: (row: Row) => string | undefined;
  /** Rândul (rândurile) de subsol — `<tr>` complet, `colSpan`-ul rămâne la latitudinea apelantului. */
  footer?: ReactNode;
  className?: string;
}

/** Tabel de tipărit A4 (32f, COMPONENTE.md §0g) — cap de tabel repetat pe fiecare pagină la print. */
export function PrintTable<Row>({ columns, rows, rowKey, rowClassName, footer, className }: PrintTableProps<Row>) {
  const classes = className ? `${styles.table} ${className}` : styles.table;
  return (
    <table className={classes}>
      <thead>
        <tr>
          {columns.map(column => (
            <th key={column.key} className={column.align === 'end' ? styles.amountCol : undefined}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={rowKey(row)} className={rowClassName?.(row)}>
            {columns.map(column => (
              <td key={column.key} className={column.align === 'end' ? styles.amountCol : undefined}>
                {column.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {footer && <tfoot>{footer}</tfoot>}
    </table>
  );
}
