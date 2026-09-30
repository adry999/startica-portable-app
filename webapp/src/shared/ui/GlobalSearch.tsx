import { useState } from 'react';
import { Popover } from './Popover';
import { SearchInput } from './SearchInput';
import styles from './GlobalSearch.module.css';

export interface GlobalSearchResult {
  key: string;
  label: string;
  /** Ex. „Copil” / „Angajat” — categoria rezultatului. */
  category?: string;
  onSelect: () => void;
}

export interface GlobalSearchProps {
  value: string;
  onChange: (value: string) => void;
  results: GlobalSearchResult[];
  /** Arată un rând „Se caută…” în loc de rezultate. */
  loading?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Căutare globală din antet (32a) — complet controlată: apelantul ține `value`/`results`/`loading`
 * și rulează căutarea efectivă. V1 simplificat: fără grupare pe tip, „Vezi toate” sau navigare cu
 * tastatura în listă — rezultatele sunt o listă plată, clic pentru selecție.
 */
export function GlobalSearch({
  value,
  onChange,
  results,
  loading,
  placeholder = 'Caută…',
  ariaLabel = 'Căutare globală',
  className,
}: GlobalSearchProps) {
  const [focused, setFocused] = useState(false);
  const showPanel = focused && (loading || results.length > 0);

  const classes = className ? `${styles.root} ${className}` : styles.root;

  return (
    <div className={classes} onFocus={() => setFocused(true)}>
      <SearchInput value={value} onChange={onChange} placeholder={placeholder} ariaLabel={ariaLabel} />

      {showPanel && (
        <Popover onClose={() => setFocused(false)} ariaLabel={`Rezultate — ${ariaLabel}`} className={styles.panel}>
          {loading ? (
            <p className={styles.status}>Se caută…</p>
          ) : (
            <ul className={styles.list}>
              {results.map(result => (
                <li key={result.key}>
                  <button
                    type="button"
                    className={styles.result}
                    onClick={() => {
                      result.onSelect();
                      setFocused(false);
                    }}
                  >
                    <span className={styles.resultLabel}>{result.label}</span>
                    {result.category && <span className={styles.resultCategory}>{result.category}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover>
      )}
    </div>
  );
}
