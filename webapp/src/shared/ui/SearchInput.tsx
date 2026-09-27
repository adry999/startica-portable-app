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
  const classes = className ? `${styles.search} ${className}` : styles.search;
  return (
    <input
      className={classes}
      type="search"
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );
}
