import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './EmptyState.module.css';

export type EmptyStateVariant = 'no-results' | 'first' | 'done' | 'period';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  /** `'no-results'` (implicit) — filtre/căutare fără rezultate (prioritate peste orice altă variantă, 30-stari-goale.md)
   * · `'first'` — modulul n-a avut niciodată date · `'done'` — coadă golită · `'period'` — perioada afișată n-are date. */
  variant?: EmptyStateVariant;
  title: string;
  description?: ReactNode;
  /** `'compact'` (35d) — un rând 13px `--muted`, fără chenar și fără puncte, padding 8px 0, acțiunea
   * ca link. Doar în interiorul unui card care are deja propriul titlu — ignoră decorul specific
   * variantei (puncte pe `first`, fundal mint pe `done`), varianta rămâne relevantă doar pentru
   * alegerea automată din `DataTable`/catalog. */
  size?: 'compact';
  /** Doar `no-results`: etichetele filtrelor active, ex. `['Arhivați', 'Grupa Mars']`. */
  activeFilters?: string[];
  onClearFilters?: () => void;
  /** `first`/`period`: CTA primar, ex. „+ Cheltuială nouă” — pe `period` doar dacă acțiunea are sens pe perioada afișată. */
  action?: EmptyStateAction;
  /** Doar `first` (35a, `copii.first` — „Din vizitele programate”): buton secundar, arătat doar când apelantul îl dă (ex. doar dacă există vizite programate). */
  secondaryAction?: EmptyStateAction;
}

/**
 * Cele patru stări de listă goală din 30-stari-goale.md — se dă drept `DataTable.empty`
 * (cheie din `empty-states.ts`) sau randată direct, pentru liste care nu sunt un `DataTable`.
 */
export function EmptyState({
  variant = 'no-results',
  title,
  description,
  size,
  activeFilters,
  onClearFilters,
  action,
  secondaryAction,
}: EmptyStateProps) {
  if (size === 'compact') {
    return (
      <div className={styles.compact}>
        <span className={styles.compactText}>{title}</span>
        {action && (
          <Button variant="link" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'done') {
    return (
      <div className={styles.done}>
        <strong className={styles.title}>{title}</strong>
        {description && <p className={styles.doneText}>{description}</p>}
      </div>
    );
  }

  if (variant === 'first') {
    return (
      <div className={styles.first}>
        <div className={styles.dots} aria-hidden="true">
          <span className={styles.dotOrange} />
          <span className={styles.dotYellow} />
          <span className={styles.dotMint} />
        </div>
        <strong className={styles.title}>{title}</strong>
        {description && <p className={styles.text}>{description}</p>}
        {(action || secondaryAction) && (
          <div className={styles.actions}>
            {action && (
              <Button variant="primary" onClick={action.onClick}>
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'period') {
    return (
      <div className={styles.period}>
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
