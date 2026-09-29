import styles from './TextField.module.css';

export interface TextFieldProps {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'tel';
  placeholder?: string;
  ariaLabel?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Câmp de text pe o singură linie, fără iconiță — ex. nume/telefon la SMS manual (11c/11d „Alt număr”). */
export function TextField({
  value,
  onChange,
  type = 'text',
  placeholder,
  ariaLabel,
  invalid,
  disabled,
  className,
}: TextFieldProps) {
  const classes = [styles.input, invalid ? styles.invalid : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <input
      className={classes}
      type={type}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      disabled={disabled}
    />
  );
}
