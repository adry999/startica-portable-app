import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { readStoredPageSize, storePageSize } from '@shared/state/table-page-size';
import { EmptyState } from './EmptyState';
import { EMPTY_STATES, resolveEmptyStateText, resolveEmptyStateTitle, type EmptyStateKey } from './empty-states';
import { Pagination } from './Pagination';
import styles from './DataTable.module.css';

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  /** Lipsă = coloana nu e sortabilă (click pe antet nu face nimic). `null` = rândul rămâne
   * mereu la coadă (ex. „Fără grupă”, fără scadență), indiferent de direcția sortării. */
  sortValue?: (row: Row) => string | number | null;
  align?: 'start' | 'end';
}

export interface DataTableGroupBy<Row> {
  /** Cheia grupului (ex. `departmentId`). */
  key: (row: Row) => string;
  /** Conținutul rândului-titlu pentru un grup — pătrat, nume, număr: la latitudinea apelantului. */
  label: (key: string) => ReactNode;
  /** Ordinea grupurilor; grupurile care apar în date dar nu sunt în listă vin la coadă, în ordinea de apariție. */
  order?: string[];
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  pageSize?: number;
  /** Stare goală scrisă manual — dacă e dată, are prioritate peste `empty` (R9, retro-compatibil). */
  emptyState?: ReactNode;
  /** Cheie din `empty-states.ts` — DataTable alege singur varianta (first/done/period), cu excepția
   * „Fără rezultate", care are mereu prioritate cât timp `hasActiveFilters` e adevărat (30-stari-goale.md). */
  empty?: EmptyStateKey;
  emptyParams?: Record<string, string>;
  hasActiveFilters?: boolean;
  activeFilterLabels?: string[];
  onClearFilters?: () => void;
  /** Butonul din stările `first`/`period` — necesar doar dacă cheia din `empty` are `actionLabel`. */
  onEmptyAction?: () => void;
  /** Butonul secundar (ex. `copii.first` — „Din vizitele programate”) — necesar doar dacă cheia din `empty` are `secondaryActionLabel`. */
  onEmptySecondaryAction?: () => void;
  onRowClick?: (row: Row) => void;
  /** Clasă opțională per rând (ex. evidențierea rândului care corespunde zilei alese în alt panou). */
  rowClassName?: (row: Row) => string | undefined;
  selectable?: boolean;
  selectedRowKeys?: ReadonlySet<string>;
  onSelectedRowKeysChange?: (keys: ReadonlySet<string>) => void;
  /** Fără fundal/bordură/umbră proprii — pentru ecranele care pun tabelul într-un container deja bordat
   * (bară de filtre + bară de selecție + tabel, ca un singur card, nu cutie-în-cutie). */
  bare?: boolean;
  /** Rânduri-titlu între grupuri (ex. departamentele din 23a). Dezactivează paginarea. */
  groupBy?: DataTableGroupBy<Row>;
  /** Sortarea implicită la montare (13.1 PROMPT-8 §13) — doar cât timp `sort` nu e controlat extern.
   * Fără efect dacă `sort`/`onSortChange` sunt date (sortarea controlată vine deja cu valoarea ei). */
  defaultSort?: DataTableSort;
  /** Sortare controlată (ex. `usePersistedState`, ca alegerea utilizatorului să supraviețuiască
   * schimbării de pagină/remontării) — fără ea, DataTable își ține singur starea (necontrolat),
   * ca până acum. `sort`/`onSortChange` vin mereu împreună. */
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null) => void;
  /** Pagina curentă controlată (13.2 PROMPT-8 §13 — „pagina” păstrată în URL). Fără ea, DataTable
   * își ține singur pagina (necontrolat), ca până acum. */
  page?: number;
  onPageChange?: (page: number) => void;
}

export type SortDirection = 'asc' | 'desc';
export interface DataTableSort {
  key: string;
  direction: SortDirection;
}

/**
 * Tabel generic: sortare pe coloană + paginare + selecție, scrise o singură dată.
 * Filtrarea rămâne responsabilitatea ecranului (`rows` e deja filtrat) — DataTable
 * nu cunoaște regulile de business ale filtrelor, doar randează ce primește.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  pageSize,
  emptyState,
  empty,
  emptyParams,
  hasActiveFilters = false,
  activeFilterLabels,
  onClearFilters,
  onEmptyAction,
  onEmptySecondaryAction,
  onRowClick,
  rowClassName,
  selectable = false,
  selectedRowKeys,
  onSelectedRowKeysChange,
  bare = false,
  groupBy,
  defaultSort,
  sort: controlledSort,
  onSortChange,
  page: controlledPage,
  onPageChange,
}: DataTableProps<Row>) {
  const [internalSort, setInternalSort] = useState<DataTableSort | null>(() => defaultSort ?? null);
  const [internalPage, setInternalPage] = useState(1);
  // „Pe pagină N ▾” (COMPONENTE.md §Pagination) — mereu internă, niciun apelant nu are azi
  // nevoie s-o controleze din afară, spre deosebire de `sort`/`page` (URL, 13.2). Fără un `pageSize`
  // explicit (tabelele generice de listă), alegerea e o preferință per calculator, comună tuturor
  // tabelelor — altfel utilizatorul ar trebui să-și reselecteze „50” de fiecare dată.
  const [internalPageSize, setInternalPageSize] = useState(() => pageSize ?? readStoredPageSize());
  // Controlat doar dacă apelantul dă `sort`/`page` — altfel starea rămâne internă, exact ca până acum.
  const sort = controlledSort !== undefined ? controlledSort : internalSort;
  const page = controlledPage !== undefined ? controlledPage : internalPage;
  const setSort = onSortChange ?? setInternalSort;
  const setPage = onPageChange ?? setInternalPage;

  function changePageSize(nextPageSize: number) {
    setInternalPageSize(nextPageSize);
    storePageSize(nextPageSize);
    setPage(1);
  }

  // F1 (FEEDBACK-01-10.md): schimbarea setului de rânduri (filtru/căutare) duce mereu înapoi la pagina 1.
  // Semnătura (nu `rows` direct) ca să nu sară la pagina 1 doar pentru că apelantul
  // recalculează un array nou cu aceleași rânduri la fiecare randare.
  const rowsSignature = useMemo(() => rows.map(rowKey).join('\u0000'), [rows, rowKey]);
  // Prima rulare (montarea) nu trebuie să forțeze pagina 1 — altfel o pagină controlată, restaurată
  // din URL (§13.2 PROMPT-8, „pagina" păstrată la întoarcerea din fișă), ar fi suprascrisă imediat.
  const isFirstRowsSignature = useRef(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- doar schimbarea semnăturii trebuie să resteze pagina.
  useEffect(() => {
    if (isFirstRowsSignature.current) {
      isFirstRowsSignature.current = false;
      return;
    }
    setPage(1);
  }, [rowsSignature]);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find(c => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = column.sortValue!(a);
      const vb = column.sortValue!(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (va < vb) return -1 * factor;
      if (va > vb) return 1 * factor;
      return 0;
    });
  }, [rows, sort, columns]);

  const groupedBuckets = useMemo(() => {
    if (!groupBy) return null;
    const buckets = new Map<string, Row[]>();
    for (const row of sortedRows) {
      const key = groupBy.key(row);
      const list = buckets.get(key);
      if (list) list.push(row);
      else buckets.set(key, [row]);
    }
    const orderedKeys: string[] = [];
    for (const key of groupBy.order ?? []) {
      if (buckets.has(key)) orderedKeys.push(key);
    }
    for (const key of buckets.keys()) {
      if (!orderedKeys.includes(key)) orderedKeys.push(key);
    }
    return orderedKeys.map(key => ({ key, rows: buckets.get(key)! }));
  }, [sortedRows, groupBy]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / internalPageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = groupBy
    ? sortedRows
    : sortedRows.slice((currentPage - 1) * internalPageSize, (currentPage - 1) * internalPageSize + internalPageSize);

  // F21 (PROMPT-11 §9): crescător -> descrescător -> revine la implicit (nu un toggle etern).
  function toggleSort(column: DataTableColumn<Row>) {
    if (!column.sortValue) return;
    setPage(1);
    if (sort?.key !== column.key) {
      setSort({ key: column.key, direction: 'asc' });
    } else if (sort.direction === 'asc') {
      setSort({ key: column.key, direction: 'desc' });
    } else {
      setSort(defaultSort ?? null);
    }
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

  const resolvedEmptyState =
    emptyState ??
    (hasActiveFilters ? (
      <EmptyState
        variant="no-results"
        title="Fără rezultate"
        activeFilters={activeFilterLabels}
        onClearFilters={onClearFilters}
      />
    ) : empty ? (
      (() => {
        const entry = EMPTY_STATES[empty];
        return (
          <EmptyState
            variant={entry.variant}
            title={resolveEmptyStateTitle(entry, emptyParams)}
            description={resolveEmptyStateText(entry, emptyParams)}
            action={
              entry.actionLabel && onEmptyAction ? { label: entry.actionLabel, onClick: onEmptyAction } : undefined
            }
            secondaryAction={
              entry.secondaryActionLabel && onEmptySecondaryAction
                ? { label: entry.secondaryActionLabel, onClick: onEmptySecondaryAction }
                : undefined
            }
          />
        );
      })()
    ) : undefined);

  if (rows.length === 0 && resolvedEmptyState) {
    return <div className={styles.empty}>{resolvedEmptyState}</div>;
  }

  const allOnPageSelected = pageRows.length > 0 && pageRows.every(row => selectedRowKeys?.has(rowKey(row)));

  function renderDataRow(row: Row) {
    const key = rowKey(row);
    const selected = selectedRowKeys?.has(key) ?? false;
    return (
      <tr
        key={key}
        className={
          [onRowClick ? styles.clickableRow : '', rowClassName?.(row) ?? ''].filter(Boolean).join(' ') || undefined
        }
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
            <input type="checkbox" aria-label="Selectează rândul" checked={selected} onChange={() => toggleRow(key)} />
          </td>
        )}
        {columns.map(column => (
          <td key={column.key} className={column.align === 'end' ? styles.alignEnd : undefined}>
            {column.render(row)}
          </td>
        ))}
      </tr>
    );
  }

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
                  <button
                    type="button"
                    className={
                      sort?.key === column.key ? `${styles.sortButton} ${styles.sortButtonActive}` : styles.sortButton
                    }
                    onClick={() => toggleSort(column)}
                  >
                    {column.header}
                    <span
                      aria-hidden="true"
                      className={sort?.key === column.key ? styles.sortArrowActive : styles.sortArrow}
                    >
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
          {groupedBuckets
            ? groupedBuckets.map(({ key, rows: groupRows }) => (
                <Fragment key={key}>
                  <tr className={styles.groupRow}>
                    <td colSpan={columns.length + (selectable ? 1 : 0)}>{groupBy!.label(key)}</td>
                  </tr>
                  {groupRows.map(renderDataRow)}
                </Fragment>
              ))
            : pageRows.map(renderDataRow)}
        </tbody>
      </table>
      {!groupBy && pageCount > 1 && (
        <div className={styles.pager}>
          <Pagination
            page={currentPage}
            totalPages={pageCount}
            totalRows={sortedRows.length}
            pageSize={internalPageSize}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
          />
        </div>
      )}
    </div>
  );
}
