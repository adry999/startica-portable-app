import styles from './RadioGroup.module.css';

export interface RadioGroupOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Grupează input-urile native — permite navigare cu săgețile între opțiuni. */
  name: string;
  options: RadioGroupOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  /** Dezactivează toate opțiunile. */
  disabled?: boolean;
  className?: string;
}

/** Grup de radio-butoane verticale (`COMPONENTE.md` §0i) — input nativ ascuns vizual + indicator
 * circular desenat, ca bifa lui `Checkbox`: gol = contur `--input-border`, bifat = punct
 * `--orange-strong` în interior. */
export function RadioGroup({ name, options, value, onChange, ariaLabel, disabled, className }: RadioGroupProps) {
  const classes = className ? `${styles.group} ${className}` : styles.group;

  return (
    <div className={classes} role="radiogroup" aria-label={ariaLabel}>
      {options.map(option => {
        const optionDisabled = disabled || option.disabled;
        return (
          <label key={option.value} className={optionDisabled ? `${styles.option} ${styles.disabled}` : styles.option}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              disabled={optionDisabled}
              onChange={() => onChange(option.value)}
              className={styles.input}
            />
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.label}>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
