import { Icon } from './Icon';
import styles from './ActiveFilters.module.css';

export interface ActiveFilterChip {
  key: string;
  label: string;
  onClear: () => void;
}

export interface ActiveFiltersProps {
  filters: ActiveFilterChip[];
  onReset: () => void;
}

/**
 * Rândul „Filtre active" de sub bara de filtre (27a, COMPONENTE.md §0b) — un chip „Etichetă ×"
 * per filtru activ + „Șterge filtrele". Apelantul decide când să-l randeze (doar dacă e activ
 * cel puțin un filtru), la fel cum decide și pentru `SelectionBar`.
 */
export function ActiveFilters({ filters, onReset }: ActiveFiltersProps) {
  return (
    <div className={styles.bar}>
      <span className={styles.label}>Filtre active:</span>
      {filters.map(filter => (
        <button key={filter.key} type="button" className={styles.chip} onClick={filter.onClear}>
          {filter.label} <Icon name="close" size={14} />
        </button>
      ))}
      <button type="button" className={styles.reset} onClick={onReset}>
        Șterge filtrele
      </button>
    </div>
  );
}
