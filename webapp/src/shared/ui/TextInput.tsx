import type { FocusEvent, KeyboardEvent, ReactNode } from 'react';
import styles from './TextInput.module.css';

export interface TextInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'tel' | 'email' | 'password';
  placeholder?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'search' | 'url' | 'none';
  prefix?: ReactNode;
  suffix?: ReactNode;
  className?: string;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  /** Scurtături de tastatură (ex. Enter salvează, Esc renunță) — ex. redenumirea inline a unei categorii. */
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/** Câmp de text pe o singură linie (25a, `COMPONENTE.md` §0) — folosit direct sau prin `Field`. */
export function TextInput({
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
  ariaLabel,
  ariaDescribedBy,
  invalid,
  disabled,
  required,
  autoFocus,
  maxLength,
  inputMode,
  prefix,
  suffix,
  className,
  onBlur,
  onKeyDown,
}: TextInputProps) {
  const classes = [styles.box, invalid ? styles.invalid : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {prefix && <span className={styles.affix}>{prefix}</span>}
      <input
        id={id}
        className={styles.input}
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        maxLength={maxLength}
        inputMode={inputMode}
      />
      {suffix && <span className={styles.affix}>{suffix}</span>}
    </div>
  );
}
