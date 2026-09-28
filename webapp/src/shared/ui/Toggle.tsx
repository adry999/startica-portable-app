import styles from './Toggle.module.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Obligatoriu când rândul nu are deja un text vizibil asociat (ex. într-un tabel fără etichetă pe rând). */
  ariaLabel?: string;
  disabled?: boolean;
}

/** Comutator 46×26 `--orange` (12-administrare.md §10b) — preferințe de notificare, canale. */
export function Toggle({ checked, onChange, ariaLabel, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={checked ? `${styles.track} ${styles.on}` : styles.track}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} />
    </button>
  );
}
