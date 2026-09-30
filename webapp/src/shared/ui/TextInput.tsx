import type { ReactNode } from 'react';
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
  autoFocus?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  className?: string;
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
  autoFocus,
  prefix,
  suffix,
  className,
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
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      {suffix && <span className={styles.affix}>{suffix}</span>}
    </div>
  );
}
