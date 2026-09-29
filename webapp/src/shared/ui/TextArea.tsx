import styles from './TextArea.module.css';

export interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
}

/** Câmp de text liber pe mai multe linii — ex. SMS manual (11c/11d „Text liber”). */
export function TextArea({
  value,
  onChange,
  placeholder,
  ariaLabel,
  rows = 4,
  maxLength,
  disabled,
  className,
}: TextAreaProps) {
  const classes = className ? `${styles.textarea} ${className}` : styles.textarea;
  return (
    <textarea
      className={classes}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      rows={rows}
      maxLength={maxLength}
      disabled={disabled}
    />
  );
}
