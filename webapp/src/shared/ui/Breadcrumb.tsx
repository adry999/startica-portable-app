import { Icon } from './Icon';
import styles from './Breadcrumb.module.css';

export interface BreadcrumbItem {
  label: string;
  /** Lipsă = ultimul element (pagina curentă, nu mai e link). */
  onClick?: () => void;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/** Fir de ariadnă (COMPONENTE.md §0c, 28d) — ex. „Copii › Ionescu Maria”. */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Fir de ariadnă" className={className}>
      <ol className={styles.list}>
        {items.map((item, index) => (
          <li key={item.label} className={styles.item}>
            {item.onClick ? (
              <button type="button" className={styles.link} onClick={item.onClick}>
                {item.label}
              </button>
            ) : (
              <span className={styles.current} aria-current="page">
                {item.label}
              </span>
            )}
            {index < items.length - 1 && <Icon name="chevron-right" size={14} className={styles.separator} />}
          </li>
        ))}
      </ol>
    </nav>
  );
}
