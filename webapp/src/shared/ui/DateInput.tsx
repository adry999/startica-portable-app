import type { ReactNode } from 'react';
import styles from './DateInput.module.css';

export interface DateInputProps {
  id?: string;
  /** ISO `aaaa-ll-zz` — browserul îl afișează localizat (ro-RO: zz.ll.aaaa). */
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
  /** Text informativ după câmp, ex. „4 ani”. */
  trailing?: ReactNode;
  className?: string;
}

/** Câmp de dată (25b, `COMPONENTE.md` §0) — afișare zz.ll.aaaa, cu `trailing` opțional. */
export function DateInput({
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
}: DateInputProps) {
  const classes = [styles.box, invalid ? styles.invalid : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <input
        id={id}
        className={styles.input}
        type="date"
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
