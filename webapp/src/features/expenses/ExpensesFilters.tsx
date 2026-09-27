import { FilterPills, SearchInput, SegmentedControl } from '@shared/ui';
import { categoryStyleFor } from './useExpenses';
import { METHOD_TONE } from './expenseColumns';
import styles from './ExpensesPage.module.css';

export type ArchiveFilter = 'active' | 'archived' | 'all';

export interface ExpensesFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  monthFrom: string;
  onMonthFromChange: (value: string) => void;
  monthTo: string;
  onMonthToChange: (value: string) => void;
  archiveFilter: ArchiveFilter;
  onArchiveFilterChange: (value: ArchiveFilter) => void;
  activeTotal: number;
  archivedTotal: number;
  category: string;
  onCategoryChange: (value: string) => void;
  categoryNames: string[];
  method: string;
  onMethodChange: (value: string) => void;
}

export function ExpensesFilters({
  search,
  onSearchChange,
  monthFrom,
  onMonthFromChange,
  monthTo,
  onMonthToChange,
  archiveFilter,
  onArchiveFilterChange,
  activeTotal,
  archivedTotal,
  category,
  onCategoryChange,
  categoryNames,
  method,
  onMethodChange,
}: ExpensesFiltersProps) {
  return (
    <>
      <div className={styles.toolbar}>
        <SearchInput
          placeholder="Caută descriere sau categorie…"
          value={search}
          onChange={onSearchChange}
          ariaLabel="Caută cheltuială"
        />
        <input
          className={styles.select}
          type="month"
          value={monthFrom}
          onChange={event => onMonthFromChange(event.target.value)}
          aria-label="De la luna"
        />
        <input
          className={styles.select}
          type="month"
          value={monthTo}
          onChange={event => onMonthToChange(event.target.value)}
          aria-label="Până la luna"
        />
        <SegmentedControl
          ariaLabel="Filtru arhivare"
          value={archiveFilter}
          onChange={onArchiveFilterChange}
          options={[
            { value: 'active', label: `Activi · ${activeTotal}` },
            { value: 'archived', label: `Arhivați · ${archivedTotal}` },
            { value: 'all', label: `Toți · ${activeTotal + archivedTotal}` },
          ]}
        />
      </div>

      <FilterPills
        groups={[
          {
            label: 'Categorie',
            value: category,
            onChange: onCategoryChange,
            options: [
              { value: '', label: 'Toate', tone: 'neutral' },
              ...categoryNames.map(name => ({
                value: name,
                label: name,
                tone: categoryStyleFor(name).tone,
              })),
            ],
          },
          {
            label: 'Metodă',
            value: method,
            onChange: onMethodChange,
            options: [
              { value: '', label: 'Toate', tone: 'neutral' },
              { value: 'cash', label: 'Cash', tone: METHOD_TONE.cash },
              { value: 'card', label: 'Card', tone: METHOD_TONE.card },
              { value: 'transfer', label: 'Transfer', tone: METHOD_TONE.transfer },
            ],
          },
        ]}
      />
    </>
  );
}
