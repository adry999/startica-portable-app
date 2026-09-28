import { useRef } from 'react';
import { FilterPills, SearchInput } from '@shared/ui';
import { categoryStyleFor } from './useExpenses';
import { METHOD_TONE } from './expenseColumns';
import styles from './ExpensesPage.module.css';

export type ArchiveFilter = 'active' | 'archived' | 'all';

const ARCHIVE_LABEL: Record<ArchiveFilter, string> = {
  active: 'Nearhivate',
  archived: 'Arhivate',
  all: 'Toate',
};
const ARCHIVE_OPTIONS: ArchiveFilter[] = ['active', 'archived', 'all'];

export interface ExpensesFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  archiveFilter: ArchiveFilter;
  onArchiveFilterChange: (value: ArchiveFilter) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  categoryNames: string[];
  method: string;
  onMethodChange: (value: string) => void;
}

/** Dropdown „Nearhivate ▾" — 06-cheltuieli.md #3, E-5 (etichetele corecte, la feminin, pentru „cheltuieli"). */
function ArchiveFilterDropdown({
  value,
  onChange,
}: {
  value: ArchiveFilter;
  onChange: (value: ArchiveFilter) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details ref={detailsRef} className={styles.archiveDropdown}>
      <summary>{ARCHIVE_LABEL[value]} ▾</summary>
      <div className={styles.archiveDropdownPanel} role="menu">
        {ARCHIVE_OPTIONS.map(option => (
          <button
            key={option}
            type="button"
            role="menuitemradio"
            aria-checked={option === value}
            onClick={() => {
              onChange(option);
              if (detailsRef.current) detailsRef.current.open = false;
            }}
          >
            {ARCHIVE_LABEL[option]}
          </button>
        ))}
      </div>
    </details>
  );
}

export function ExpensesFilters({
  search,
  onSearchChange,
  archiveFilter,
  onArchiveFilterChange,
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
          placeholder="Caută furnizor sau descriere"
          value={search}
          onChange={onSearchChange}
          ariaLabel="Caută cheltuială"
        />
        <ArchiveFilterDropdown value={archiveFilter} onChange={onArchiveFilterChange} />
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
