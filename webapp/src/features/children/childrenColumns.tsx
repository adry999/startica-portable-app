import { Badge, RowMenu, groupTone, type DataTableColumn, type PillTone } from '@shared/ui';
import { initials } from '@shared/format/initials';
import type { Group } from '@contracts/record-types.mjs';
import type { ChildRow } from './useChildren';
import styles from './ChildrenPage.module.css';

const AVATAR_TONE_CLASS: Record<PillTone, string> = {
  orange: 'toneOrange',
  mint: 'toneMint',
  yellow: 'toneYellow',
  pink: 'tonePink',
  neutral: 'toneOrange',
};

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
      render: row => (
        <div className={styles.childCell}>
          <span className={`${styles.avatar} ${styles[AVATAR_TONE_CLASS[groupTone(row.groupId, groups)]]}`}>
            {initials(row.name)}
          </span>
          <div>
            <strong>{row.name}</strong>
            <small>{row.contractLabel}</small>
          </div>
        </div>
      ),
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
