import { useRef, type ReactNode } from 'react';
import styles from './RowMenu.module.css';

export interface RowMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
}

export interface RowMenuProps {
  items: RowMenuItem[];
  ariaLabel?: string;
  /** Declanșatorul meniului — implicit „⋯” (rândurile de tabel); text pentru meniuri ca „Mută în grupă” din bara de selecție. */
  trigger?: ReactNode;
}

/** Meniul ⋯ de pe rândul unui tabel — un singur loc, în loc de câte o copie per ecran. */
export function RowMenu({ items, ariaLabel = 'Mai multe acțiuni', trigger = '⋯' }: RowMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details ref={detailsRef} className={styles.rowMenu} onClick={event => event.stopPropagation()}>
      <summary aria-label={ariaLabel}>{trigger}</summary>
      <div className={styles.rowMenuPanel}>
        {items.map(item => (
          <button
            key={item.label}
            type="button"
            className={item.danger ? styles.rowMenuDanger : undefined}
            disabled={item.disabled}
            title={item.title}
            onClick={() => {
              if (detailsRef.current) detailsRef.current.open = false;
              item.onClick();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </details>
  );
}
