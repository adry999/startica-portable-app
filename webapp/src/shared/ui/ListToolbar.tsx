import type { ReactNode } from 'react';
import { SearchInput } from './SearchInput';
import styles from './ListToolbar.module.css';

export interface ListToolbarSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  /** Ecranul apelant poate impune o lățime fixă (ex. Candidați, 360px) în loc de flex:1 implicit. */
  className?: string;
}

export interface ListToolbarProps {
  search: ListToolbarSearch;
  /** Contor la capătul barei, ex. „8 persoane”. */
  trailing?: ReactNode;
  /** Opțional: SegmentedControl Active/Arhivate, butonul „Funcții”, etc. */
  children?: ReactNode;
  /** Clasă opțională a ecranului apelant (ex. padding/bordură specifice contextului). */
  className?: string;
}

/** Rândul căutare + acțiuni opționale de deasupra unui `DataTable` (Copii, Personal, Candidați). */
export function ListToolbar({ search, trailing, children, className }: ListToolbarProps) {
  return (
    <div className={className ? `${styles.bar} ${className}` : styles.bar}>
      <SearchInput
        value={search.value}
        onChange={search.onChange}
        placeholder={search.placeholder}
        ariaLabel={search.ariaLabel}
        className={search.className}
      />
      {children}
      {trailing != null && <span className={styles.trailing}>{trailing}</span>}
    </div>
  );
}
