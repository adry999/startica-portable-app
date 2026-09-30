import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './SelectionBar.module.css';

export interface SelectionBarProps {
  /** „3 selectați" sau „3 selectate · 120 MDL" — formatat de ecran, care știe ce numără. */
  label: ReactNode;
  /** Butoanele specifice ecranului (Mută în grupă, Exportă, Arhivează…), cu clasele lui proprii. */
  children?: ReactNode;
  onCancel?: () => void;
  /** Plutitoare, cu margine și umbră (`--shadow-floating-bar`) — Achitări (05-achitari.md §3).
   * Implicit inline în flux, ca în Copii/Cheltuieli (02-copii-lista.md). */
  floating?: boolean;
}

/** Bara „N selectate" de sub bara de filtre — un singur container, în loc de câte o copie per ecran. */
export function SelectionBar({ label, children, onCancel, floating = false }: SelectionBarProps) {
  const classes = floating ? `${styles.bar} ${styles.floating}` : styles.bar;
  return (
    <div className={classes}>
      <span>{label}</span>
      {children}
      {onCancel && (
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Anulează <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}
