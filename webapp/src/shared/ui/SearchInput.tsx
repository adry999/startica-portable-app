import { Icon } from './Icon';
import styles from './SearchInput.module.css';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}

/** Caseta de căutare din toolbar-urile de listă (Copii, Cheltuieli, Taxe, Verificare). */
export function SearchInput({ value, onChange, placeholder, ariaLabel, className }: SearchInputProps) {
  const classes = className ? `${styles.wrap} ${className}` : styles.wrap;
  return (
    <span className={classes}>
      <span className={styles.icon}>
        <Icon name="search" size={14} />
      </span>
      <input
        className={styles.input}
        type="search"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </span>
  );
}
