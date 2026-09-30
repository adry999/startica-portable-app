import type { ReactNode } from 'react';
import styles from './MonthInput.module.css';

export interface MonthInputProps {
  id?: string;
  /** ISO `aaaa-ll` — browserul îl afișează localizat. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  trailing?: ReactNode;
  className?: string;
}

/** Câmp de lună (25b, `COMPONENTE.md` §0) — variantă `DateInput` pentru `type="month"`, cu `trailing` opțional. */
export function MonthInput({
  id,
  value,
  onChange,
  min,
  max,
  required,
  ariaLabel,
  ariaDescribedBy,
  invalid,
  disabled,
  autoFocus,
  trailing,
  className,
}: MonthInputProps) {
  const classes = [styles.box, invalid ? styles.invalid : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <input
        id={id}
        className={styles.input}
        type="month"
        value={value}
        onChange={event => onChange(event.target.value)}
        min={min}
        max={max}
        required={required}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      {trailing && <span className={styles.affix}>{trailing}</span>}
    </div>
  );
}
