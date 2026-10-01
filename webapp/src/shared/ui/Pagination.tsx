import { IconButton } from './IconButton';
import { pageWindow } from './page-window';
import { Select } from './Select';
import styles from './Pagination.module.css';

export interface PaginationProps {
  /** Pagina curentă, 1-indexat. */
  page: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (pageSize: number) => void;
  ariaLabel?: string;
  className?: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * Chrome de paginare pentru `DataTable` (COMPONENTE.md §Pagination, 27a·38a):
 * „Pe pagină 25 ▾” · „26–50 din 312” · ‹ 1 2 3 4 … 13 ›. Ascunsă la o singură pagină.
 */
export function Pagination({
  page,
  totalPages,
  totalRows,
  pageSize,
  onPageChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
  ariaLabel = 'Pagini',
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const classes = className ? `${styles.pagination} ${className}` : styles.pagination;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(totalRows, page * pageSize);

  return (
    <div className={classes}>
      <div className={styles.info}>
        {onPageSizeChange && (
          <span className={styles.pageSize}>
            Pe pagină
            <Select
              size="sm"
              ariaLabel="Rânduri pe pagină"
              value={String(pageSize)}
              onChange={value => onPageSizeChange(Number(value))}
              options={pageSizeOptions.map(size => ({ value: String(size), label: String(size) }))}
            />
          </span>
        )}
        <span>
          {from}–{to} din {totalRows}
        </span>
      </div>
      <nav className={styles.nav} aria-label={ariaLabel}>
        <IconButton
          icon="chevron-left"
          ariaLabel="Pagina anterioară"
          className={styles.arrow}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        {pageWindow(page, totalPages).map((item, itemIndex) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${itemIndex}`} className={styles.ellipsis} aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={item === page ? `${styles.pageButton} ${styles.pageButtonActive}` : styles.pageButton}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <IconButton
          icon="chevron-right"
          ariaLabel="Pagina următoare"
          className={styles.arrow}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        />
      </nav>
    </div>
  );
}
