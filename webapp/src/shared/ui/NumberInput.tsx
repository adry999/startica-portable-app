import type { ReactNode } from 'react';
import styles from './NumberInput.module.css';

export interface NumberInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number | string;
  required?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  suffix?: ReactNode;
  className?: string;
}

/** Câmp numeric (25b, `COMPONENTE.md` §0) — `TextInput` fără săgeți native, cifre aliniate (`tabular-nums`). */
export function NumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step = '0.01',
  required,
  placeholder,
  ariaLabel,
  ariaDescribedBy,
  invalid,
  disabled,
  autoFocus,
  suffix,
  className,
}: NumberInputProps) {
  const classes = [styles.box, invalid ? styles.invalid : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <input
        id={id}
        className={styles.input}
        type="number"
        inputMode="numeric"
        value={value}
        onChange={event => onChange(event.target.value)}
        min={min}
        max={max}
        step={step}
        required={required}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {suffix && <span className={styles.affix}>{suffix}</span>}
    </div>
  );
}
