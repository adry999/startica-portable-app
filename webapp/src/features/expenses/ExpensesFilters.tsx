import { useState } from 'react';
import { Button, FilterPills, Icon, PeriodFilter, Popover, SearchInput, type PeriodPreset } from '@shared/ui';
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
  /** Perioadă cu presetări (§5.1) — independentă de `MonthStepper`-ul din antet (E-1: acela
   * controlează doar cardurile KPI), filtrează doar tabelul/„Pe zile”. */
  periodPreset: PeriodPreset;
  onPeriodPresetChange: (value: PeriodPreset) => void;
  periodFrom: string;
  onPeriodFromChange: (value: string) => void;
  periodTo: string;
  onPeriodToChange: (value: string) => void;
}

/** Dropdown „Nearhivate ▾" — 06-cheltuieli.md #3, E-5 (etichetele corecte, la feminin, pentru „cheltuieli"). */
function ArchiveFilterDropdown({
  value,
  onChange,
}: {
  value: ArchiveFilter;
  onChange: (value: ArchiveFilter) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.archiveDropdown}>
      <Button
        variant="outline"
        className={styles.archiveDropdownTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        {ARCHIVE_LABEL[value]} <Icon name="chevron-down" size={14} />
      </Button>
      {open && (
        <Popover onClose={() => setOpen(false)} ariaLabel="Filtru arhivare" className={styles.archiveDropdownPanel}>
          <div role="menu" className={styles.archiveDropdownMenu}>
            {ARCHIVE_OPTIONS.map(option => (
              <Button
                key={option}
                variant="ghost"
                className={styles.archiveDropdownOption}
                role="menuitemradio"
                aria-checked={option === value}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                {ARCHIVE_LABEL[option]}
              </Button>
            ))}
          </div>
        </Popover>
      )}
    </div>
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
  periodPreset,
  onPeriodPresetChange,
  periodFrom,
  onPeriodFromChange,
  periodTo,
  onPeriodToChange,
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
        <PeriodFilter
          preset={periodPreset}
          onPresetChange={onPeriodPresetChange}
          from={periodFrom}
          onFromChange={onPeriodFromChange}
          to={periodTo}
          onToChange={onPeriodToChange}
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
