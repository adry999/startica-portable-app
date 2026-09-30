import type { ReactNode } from 'react';
import styles from './TimeInput.module.css';

export interface TimeInputProps {
  id?: string;
  /** `HH:MM`, 24h — browserul îl afișează localizat. */
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
  /** Text informativ după câmp. */
  trailing?: ReactNode;
  className?: string;
}

/** Câmp de oră (25b, `COMPONENTE.md` §0e/30c) — aceeași formă ca `DateInput`. */
export function TimeInput({
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
}: TimeInputProps) {
  const classes = [styles.box, invalid ? styles.invalid : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <input
        id={id}
        className={styles.input}
        type="time"
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
