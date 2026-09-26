import { useMemo, useState, type ReactNode } from 'react';
import { Badge } from './Badge';
import styles from './DataTable.module.css';

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  /** Lipsă = coloana nu e sortabilă (click pe antet nu face nimic). */
  sortValue?: (row: Row) => string | number;
  align?: 'start' | 'end';
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  pageSize?: number;
  emptyState?: ReactNode;
  onRowClick?: (row: Row) => void;
  selectable?: boolean;
  selectedRowKeys?: ReadonlySet<string>;
  onSelectedRowKeysChange?: (keys: ReadonlySet<string>) => void;
  /** Fără fundal/bordură/umbră proprii — pentru ecranele care pun tabelul într-un container deja bordat
   * (bară de filtre + bară de selecție + tabel, ca un singur card, nu cutie-în-cutie). */
  bare?: boolean;
}

type SortDirection = 'asc' | 'desc';

/**
 * Tabel generic: sortare pe coloană + paginare + selecție, scrise o singură dată.
 * Filtrarea rămâne responsabilitatea ecranului (`rows` e deja filtrat) — DataTable
 * nu cunoaște regulile de business ale filtrelor, doar randează ce primește.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  pageSize = 10,
  emptyState,
  onRowClick,
  selectable = false,
  selectedRowKeys,
  onSelectedRowKeysChange,
  bare = false,
}: DataTableProps<Row>) {
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);
  const [page, setPage] = useState(0);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find(c => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = column.sortValue!(a);
      const vb = column.sortValue!(b);
      if (va < vb) return -1 * factor;
      if (va > vb) return 1 * factor;
      return 0;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = sortedRows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  function toggleSort(column: DataTableColumn<Row>) {
    if (!column.sortValue) return;
    setPage(0);
    setSort(current => {
      if (current?.key !== column.key) return { key: column.key, direction: 'asc' };
      return { key: column.key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    });
  }

  function toggleRow(key: string) {
    if (!onSelectedRowKeysChange) return;
    const next = new Set(selectedRowKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectedRowKeysChange(next);
  }

  function toggleAllOnPage() {
    if (!onSelectedRowKeysChange) return;
    const pageKeys = pageRows.map(rowKey);
    const allSelected = pageKeys.every(key => selectedRowKeys?.has(key));
    const next = new Set(selectedRowKeys);
    for (const key of pageKeys) {
      if (allSelected) next.delete(key);
      else next.add(key);
    }
    onSelectedRowKeysChange(next);
  }

  if (rows.length === 0 && emptyState) {
    return <div className={styles.empty}>{emptyState}</div>;
  }

  const allOnPageSelected = pageRows.length > 0 && pageRows.every(row => selectedRowKeys?.has(rowKey(row)));

  return (
    <div className={bare ? styles.wrapBare : styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {selectable && (
              <th className={styles.checkboxCell}>
                <input
                  type="checkbox"
                  aria-label="Selectează toate rândurile din pagină"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                />
              </th>
            )}
            {columns.map(column => (
              <th
                key={column.key}
                className={column.align === 'end' ? styles.alignEnd : undefined}
                aria-sort={sort?.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                {column.sortValue ? (
                  <button type="button" className={styles.sortButton} onClick={() => toggleSort(column)}>
                    {column.header}
                    <span aria-hidden="true">
                      {sort?.key === column.key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.map(row => {
            const key = rowKey(row);
            const selected = selectedRowKeys?.has(key) ?? false;
            return (
              <tr
                key={key}
                className={onRowClick ? styles.clickableRow : undefined}
                data-selected={selected || undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {selectable && (
                  <td className={styles.checkboxCell} onClick={event => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label="Selectează rândul"
                      checked={selected}
                      onChange={() => toggleRow(key)}
                    />
                  </td>
                )}
                {columns.map(column => (
                  <td key={column.key} className={column.align === 'end' ? styles.alignEnd : undefined}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {sortedRows.length > pageSize && (
        <div className={styles.pager}>
          <Badge tone="neutral">
            Afișez {currentPage * pageSize + 1}–{Math.min(sortedRows.length, (currentPage + 1) * pageSize)} din{' '}
            {sortedRows.length}
          </Badge>
          <div className={styles.pageButtons}>
            {Array.from({ length: pageCount }, (_, index) => (
              <button
                key={index}
                type="button"
                className={
                  index === currentPage ? `${styles.pageButton} ${styles.pageButtonActive}` : styles.pageButton
                }
                onClick={() => setPage(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
