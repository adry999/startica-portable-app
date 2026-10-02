import styles from './Checkbox.module.css';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Obligatoriu când rândul nu are deja un text vizibil asociat. */
  ariaLabel?: string;
  disabled?: boolean;
  /** „Unele bifate” (ex. antetul unei coloane de bife) — linie în loc de ✓, `aria-checked="mixed"`. */
  indeterminate?: boolean;
}

/** Bifă 18px, radius 5 (`COMPONENTE.md` §25c) — bifat = `--orange` plin + ✓ alb. */
export function Checkbox({ checked, onChange, ariaLabel, disabled, indeterminate }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={checked || indeterminate ? `${styles.box} ${styles.on}` : styles.box}
      onClick={() => onChange(!checked)}
    >
      {indeterminate ? (
        <svg className={styles.check} viewBox="0 0 12 10" aria-hidden="true">
          <path d="M1 5H11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        checked && (
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
        )
      )}
    </button>
  );
}
