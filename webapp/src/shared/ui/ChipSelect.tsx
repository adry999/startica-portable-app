import styles from './ChipSelect.module.css';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface ChipSelectProps<T extends string> {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/** Pastile de alegere unică (22b „zile”, `COMPONENTE.md` §2) — implicit fundal `--neutral-soft`,
 * selectat = `--slate` plin. */
export function ChipSelect<T extends string>({ options, value, onChange, ariaLabel }: ChipSelectProps<T>) {
  return (
    <div className={styles.group} role="radiogroup" aria-label={ariaLabel}>
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            className={active ? `${styles.pill} ${styles.active}` : styles.pill}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
