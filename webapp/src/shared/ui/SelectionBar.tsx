import type { ReactNode } from 'react';
import styles from './SelectionBar.module.css';

export interface SelectionBarProps {
  /** „3 selectați" sau „3 selectate · 120 MDL" — formatat de ecran, care știe ce numără. */
  label: ReactNode;
  /** Butoanele specifice ecranului (Mută în grupă, Exportă, Arhivează…), cu clasele lui proprii. */
  children?: ReactNode;
  onCancel?: () => void;
}

/** Bara „N selectate" de sub bara de filtre — un singur container, în loc de câte o copie per ecran. */
export function SelectionBar({ label, children, onCancel }: SelectionBarProps) {
  return (
    <div className={styles.bar}>
      <span>{label}</span>
      {children}
      {onCancel && (
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Anulează ×
        </button>
      )}
    </div>
  );
}
