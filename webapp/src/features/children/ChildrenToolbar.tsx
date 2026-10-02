import { FilterPills, ListToolbar, SegmentedControl, groupTone } from '@shared/ui';
import type { Group } from '@contracts/record-types.mjs';
import styles from './ChildrenPage.module.css';

export type ArchiveFilter = 'active' | 'archived' | 'all';

export interface ChildrenToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  archiveFilter: ArchiveFilter;
  onArchiveFilterChange: (value: ArchiveFilter) => void;
  activeTotal: number;
  archivedTotal: number;
  groupFilter: string;
  onGroupFilterChange: (value: string) => void;
  groups: Group[];
  paymentFilter: string;
  onPaymentFilterChange: (value: string) => void;
  completenessFilter: string;
  onCompletenessFilterChange: (value: string) => void;
}

export function ChildrenToolbar({
  query,
  onQueryChange,
  archiveFilter,
  onArchiveFilterChange,
  activeTotal,
  archivedTotal,
  groupFilter,
  onGroupFilterChange,
  groups,
  paymentFilter,
  onPaymentFilterChange,
  completenessFilter,
  onCompletenessFilterChange,
}: ChildrenToolbarProps) {
  return (
    <>
      <ListToolbar
        className={styles.toolbar}
        search={{
          value: query,
          onChange: onQueryChange,
          placeholder: 'Caută după nume, părinte, telefon sau nr. contract',
          ariaLabel: 'Caută copil',
        }}
      >
        <SegmentedControl
          ariaLabel="Filtru arhivare"
          value={archiveFilter}
          onChange={onArchiveFilterChange}
          options={[
            { value: 'active', label: `Activi · ${activeTotal}` },
            { value: 'archived', label: `Arhivați · ${archivedTotal}` },
            { value: 'all', label: 'Toți' },
          ]}
        />
      </ListToolbar>

      <FilterPills
        groups={[
          {
            label: 'Grupă',
            value: groupFilter,
            onChange: onGroupFilterChange,
            options: [
              { value: 'all', label: 'Toate', tone: 'neutral' },
              ...groups.map(group => ({
                value: group.id,
                label: group.name,
                tone: groupTone(group.id, groups),
              })),
              { value: 'none', label: 'Fără grupă', tone: 'neutral' },
            ],
          },
          {
            label: 'Plată',
            value: paymentFilter,
            onChange: onPaymentFilterChange,
            options: [
              { value: 'all', label: 'Toate', tone: 'neutral' },
              { value: 'Achitat', label: 'Achitat', tone: 'mint' },
              { value: 'Parțial', label: 'Parțial', tone: 'yellow' },
              { value: 'Neachitat', label: 'Neachitat', tone: 'pink' },
            ],
          },
          {
            label: 'Date',
            value: completenessFilter,
            onChange: onCompletenessFilterChange,
            options: [
              { value: 'all', label: 'Toate', tone: 'neutral' },
              { value: 'incomplete', label: 'Date incomplete', tone: 'yellow' },
            ],
          },
        ]}
      />
    </>
  );
}
