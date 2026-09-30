import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './SelectionBar.module.css';

export interface SelectionBarAction {
  label: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** `'accent'` = text roz (ex. Arhivează/Dezarhivează) — implicit alb simplu, ca restul barei. */
  tone?: 'default' | 'accent';
}

export interface SelectionBarProps {
  /** „3 selectați" sau „3 selectate · 120 MDL" — formatat de ecran, care știe ce numără. */
  label: ReactNode;
  /** Butoane text simple (Exportă, Arhivează…) — stilizate uniform, fără CSS local pe ecran. */
  actions?: SelectionBarAction[];
  /** Un singur buton distructiv, plin roz (ex. „Șterge definitiv") — cel mult unul (B2, 15h). */
  danger?: SelectionBarAction;
  /** Piese care nu sunt un buton text simplu (ex. `RowMenu` „Mută în grupă"). */
  children?: ReactNode;
  onCancel?: () => void;
  /** Plutitoare, cu margine și umbră (`--shadow-floating-bar`) — Achitări (05-achitari.md §3).
   * Implicit inline în flux, ca în Copii/Cheltuieli (02-copii-lista.md). */
  floating?: boolean;
}

/** Bara „N selectate" de sub bara de filtre — un singur container, în loc de câte o copie per ecran. */
export function SelectionBar({ label, actions, danger, children, onCancel, floating = false }: SelectionBarProps) {
  const classes = floating ? `${styles.bar} ${styles.floating}` : styles.bar;
  return (
    <div className={classes}>
      <span>{label}</span>
      {children}
      {actions?.map((action, index) => (
        <button
          key={index}
          type="button"
          className={action.tone === 'accent' ? `${styles.action} ${styles.actionAccent}` : styles.action}
          disabled={action.disabled}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
      {danger && (
        <button type="button" className={styles.danger} disabled={danger.disabled} onClick={danger.onClick}>
          {danger.label}
        </button>
      )}
      {onCancel && (
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Anulează <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}
