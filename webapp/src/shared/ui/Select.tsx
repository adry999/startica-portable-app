import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  /** Prima opțiune, cu valoarea `''` — ex. „—”. */
  placeholder?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/** Listă derulantă scurtă (25b, `COMPONENTE.md` §0) — aceeași cutie ca `TextInput` + ▾.
 * 2–8 opțiuni; peste 8, `SearchSelect`. */
export function Select({
  id,
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  ariaDescribedBy,
  invalid,
  disabled,
  required,
  autoFocus,
  className,
}: SelectProps) {
  const classes = [styles.box, invalid ? styles.invalid : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <select
        id={id}
        className={styles.select}
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className={styles.caret} aria-hidden="true">
        ▾
      </span>
    </div>
  );
}
