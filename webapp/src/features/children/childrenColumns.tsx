import { Badge, RowMenu, groupTone, type DataTableColumn, type PillTone } from '@shared/ui';
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

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
}

export interface ChildrenColumnsOptions {
  groups: Group[];
  onEdit: (row: ChildRow) => void;
  onToggleArchived: (row: ChildRow) => void;
  onRequestDelete: (row: ChildRow) => void;
}

export function buildChildrenColumns({
  groups,
  onEdit,
  onToggleArchived,
  onRequestDelete,
}: ChildrenColumnsOptions): DataTableColumn<ChildRow>[] {
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
          <Badge tone="neutral">Nealocată</Badge>
        ),
    },
    {
      key: 'due',
      header: 'Scadență',
      render: row => row.dueDateLabel,
    },
    {
      key: 'payment',
      header: 'Plată luna curentă',
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
