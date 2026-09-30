import type { KeyboardEvent } from 'react';
import styles from './TextArea.module.css';

export interface TextAreaProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  /** Scurtături de tastatură (ex. Ctrl/Cmd+Enter trimite, Esc renunță) — ex. Notă (28-fisa-copilului). */
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}

/** Câmp de text liber pe mai multe linii — ex. SMS manual (11c/11d „Text liber”), Observații (15b). */
export function TextArea({
  id,
  value,
  onChange,
  placeholder,
  ariaLabel,
  ariaDescribedBy,
  rows = 4,
  maxLength,
  disabled,
  autoFocus,
  className,
  onKeyDown,
}: TextAreaProps) {
  const classes = className ? `${styles.textarea} ${className}` : styles.textarea;
  return (
    <textarea
      id={id}
      className={classes}
      value={value}
      onChange={event => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      rows={rows}
      maxLength={maxLength}
      disabled={disabled}
      autoFocus={autoFocus}
    />
  );
}
