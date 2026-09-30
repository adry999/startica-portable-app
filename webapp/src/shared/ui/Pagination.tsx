import { IconButton } from './IconButton';
import styles from './Pagination.module.css';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Navigare pagină-cu-pagină pentru un tabel/listă lungă — v1 simplă (prev/next + „Pagina X din Y”),
 * fără butoane numerotate/elipsă (complexitate reală, amânată la o urmare).
 */
export function Pagination({ page, totalPages, onPageChange, ariaLabel = 'Pagini', className }: PaginationProps) {
  const classes = className ? `${styles.pagination} ${className}` : styles.pagination;

  return (
    <nav className={classes} aria-label={ariaLabel}>
      <IconButton
        icon="chevron-left"
        ariaLabel="Pagina anterioară"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      />
      <span className={styles.indicator}>
        Pagina {page} din {totalPages}
      </span>
      <IconButton
        icon="chevron-right"
        ariaLabel="Pagina următoare"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      />
    </nav>
  );
}
