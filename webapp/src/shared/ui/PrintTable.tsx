import type { ReactNode } from 'react';
import styles from './PrintTable.module.css';

export interface PrintTableColumn<Row> {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  align?: 'start' | 'end';
  /** Clasă adăugată pe `<th>`/`<td>` (lângă `align`) — ex. o coloană de zi îngustă (TimesheetPrint). */
  className?: string;
}

export interface PrintTableProps<Row> {
  columns: PrintTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  rowClassName?: (row: Row) => string | undefined;
  /** Rândul (rândurile) de subsol — `<tr>` complet, `colSpan`-ul rămâne la latitudinea apelantului. */
  footer?: ReactNode;
  /** Ascunde `<thead>` — pentru tabele fără antet (ex. ReportPrintSummary, listă cheie/valoare). Implicit true. */
  showHeader?: boolean;
  className?: string;
}

/** Tabel de tipărit A4 (32f, COMPONENTE.md §0g) — cap de tabel repetat pe fiecare pagină la print. */
export function PrintTable<Row>({
  columns,
  rows,
  rowKey,
  rowClassName,
  footer,
  showHeader = true,
  className,
}: PrintTableProps<Row>) {
  const classes = className ? `${styles.table} ${className}` : styles.table;

  function cellClassName(column: PrintTableColumn<Row>): string | undefined {
    return (
      [column.align === 'end' ? styles.amountCol : '', column.className ?? ''].filter(Boolean).join(' ') || undefined
    );
  }

  return (
    <table className={classes}>
      {showHeader && (
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column.key} className={cellClassName(column)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map(row => (
          <tr key={rowKey(row)} className={rowClassName?.(row)}>
            {columns.map(column => (
              <td key={column.key} className={cellClassName(column)}>
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
