import styles from './Checkbox.module.css';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Obligatoriu când rândul nu are deja un text vizibil asociat. */
  ariaLabel?: string;
  disabled?: boolean;
}

/** Bifă 18px, radius 5 (`COMPONENTE.md` §25c) — bifat = `--orange` plin + ✓ alb. */
export function Checkbox({ checked, onChange, ariaLabel, disabled }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={checked ? `${styles.box} ${styles.on}` : styles.box}
      onClick={() => onChange(!checked)}
    >
      {checked && (
        <svg className={styles.check} viewBox="0 0 12 10" aria-hidden="true">
          <path
            d="M1 5L4.5 8.5L11 1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
