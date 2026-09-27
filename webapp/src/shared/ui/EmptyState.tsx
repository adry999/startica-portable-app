import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './EmptyState.module.css';

export type EmptyStateVariant = 'no-results' | 'resolved' | 'first-step';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  /** `'no-results'` (implicit) — filtre fără rezultate · `'resolved'` — coadă golită · `'first-step'` — primul element. */
  variant?: EmptyStateVariant;
  title: string;
  description?: ReactNode;
  /** Doar `no-results`: etichetele filtrelor active, ex. `['Arhivați', 'Grupa Mars']`. */
  activeFilters?: string[];
  onClearFilters?: () => void;
  /** Doar `first-step`: CTA primar, ex. „+ Cheltuială nouă”. */
  action?: EmptyStateAction;
}

/**
 * Cele trei stări de listă goală din 13-formulare.md §15e — se dă drept `DataTable.emptyState`
 * (sau randată direct, pentru liste care nu sunt un `DataTable`).
 */
export function EmptyState({ variant = 'no-results', title, description, activeFilters, onClearFilters, action }: EmptyStateProps) {
  if (variant === 'resolved') {
    return (
      <div className={styles.resolved}>
        <strong className={styles.title}>{title}</strong>
        {description && <p className={styles.resolvedText}>{description}</p>}
      </div>
    );
  }

  if (variant === 'first-step') {
    return (
      <div className={styles.firstStep}>
        <strong className={styles.title}>{title}</strong>
        {description && <p className={styles.text}>{description}</p>}
        {action && (
          <Button variant="primary" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.noResults}>
      <div className={styles.dots} aria-hidden="true">
        <span className={styles.dotOrange} />
        <span className={styles.dotYellow} />
        <span className={styles.dotMint} />
      </div>
      <strong className={styles.title}>{title}</strong>
      {activeFilters && activeFilters.length > 0 && (
        <p className={styles.text}>Filtre active: {activeFilters.join(' · ')}</p>
      )}
      {description && <p className={styles.text}>{description}</p>}
      {onClearFilters && (
        <button type="button" className={styles.clearButton} onClick={onClearFilters}>
          Șterge filtrele
        </button>
      )}
    </div>
  );
}
