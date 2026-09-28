import { Badge, PersonCell, RowMenu, groupTone, type DataTableColumn } from '@shared/ui';
import type { Group } from '@contracts/record-types.mjs';
import type { ChildRow } from './useChildren';
import styles from './ChildrenPage.module.css';

export interface ChildrenColumnsOptions {
  groups: Group[];
  /** Lună curentă (YYYY-MM) — pentru antetul „Plată <lună>”. */
  month: string;
  onEdit: (row: ChildRow) => void;
  onToggleArchived: (row: ChildRow) => void;
  onRequestDelete: (row: ChildRow) => void;
}

export function buildChildrenColumns({
  groups,
  month,
  onEdit,
  onToggleArchived,
  onRequestDelete,
}: ChildrenColumnsOptions): DataTableColumn<ChildRow>[] {
  const currentMonthName = new Date(`${month}-01T12:00:00`).toLocaleDateString('ro-RO', { month: 'long' });
  return [
    {
      key: 'name',
      header: 'Copil',
      sortValue: row => row.name,
      render: row => <PersonCell name={row.name} sub={row.contractLabel} tone={groupTone(row.groupId, groups)} />,
    },
    {
      key: 'parent',
      header: 'Părinte',
      sortValue: row => row.parent,
      render: row => (
        <div className={styles.parentCell}>
          <span>{row.parent || '—'}</span>
          {row.phone && <small>{row.phone}</small>}
        </div>
      ),
    },
    {
      key: 'group',
      header: 'Grupă',
      sortValue: row => row.groupName,
      render: row =>
        row.groupName ? (
          <Badge tone={groupTone(row.groupId, groups)}>{row.groupName}</Badge>
        ) : (
          <Badge tone="neutral">Fără grupă</Badge>
        ),
    },
    {
      key: 'due',
      header: 'Scadență',
      render: row => row.dueDateLabel,
    },
    {
      key: 'payment',
      header: `Plată ${currentMonthName}`,
      render: row => (
        <Badge tone={row.payment.tone}>
          <span className={styles.dot} />
          {row.payment.label}
        </Badge>
      ),
    },
    {
      key: 'menu',
      header: '',
      align: 'end',
      render: row => (
        <RowMenu
          items={[
            { label: 'Editează', onClick: () => onEdit(row) },
            { label: row.archived ? 'Reactivează' : 'Arhivează', onClick: () => onToggleArchived(row) },
            {
              label: 'Șterge definitiv',
              danger: true,
              disabled: !row.archived,
              title: row.archived ? undefined : 'Arhivează întâi fișa',
              onClick: () => onRequestDelete(row),
            },
          ]}
        />
      ),
    },
  ];
}
