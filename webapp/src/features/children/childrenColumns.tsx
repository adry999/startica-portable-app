import { Badge, PersonCell, RowMenu, groupTone, type DataTableColumn } from '@shared/ui';
import { formatMonthOnly } from '#shared/format/date-format.mjs';
import { groupOrderIndex } from '@shared/format/group-order';
import type { Group } from '@contracts/record-types.mjs';
import type { ChildRow, PaymentStatusTone } from './useChildren';
import styles from './ChildrenPage.module.css';

// F21 (PROMPT-11 §9): ordinea de urgență a stărilor de plată — „Neachitat” (fundalul roz) e azi
// singura pastilă pentru restanță (domeniul nu mai distinge separat „Restanță” de „Neachitat”
// curent), deci intră prima; copiii fără pastilă (nescadenți) între ea și „Achitat”; „Fără
// obligație” rămâne ultima (nimic de urmărit).
const PAYMENT_SORT_RANK: Record<PaymentStatusTone, number> = {
  pink: 0,
  yellow: 1,
  mint: 2,
  neutral: 3,
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
  const currentMonthName = formatMonthOnly(month);
  return [
    {
      key: 'name',
      header: 'Copil',
      sortValue: row => row.name,
      render: row => <PersonCell name={row.name} sub={row.contractLabel} tone={groupTone(row.groupId, groups)} />,
    },
    {
      key: 'parent',
      header: 'Părinte · telefon',
      sortValue: row => row.parent,
      render: row => (
        <div className={styles.parentCell}>
          <span className={styles.parentName}>
            {row.parent || '—'}
            {row.child.parent2 && (
              <span
                className={styles.secondParentBadge}
                title={`Al doilea părinte: ${row.child.parent2}${row.child.phone2 ? ` · ${row.child.phone2}` : ''}`}
              >
                +1
              </span>
            )}
          </span>
          {row.phone && <small>{row.phone}</small>}
        </div>
      ),
    },
    {
      key: 'group',
      header: 'Grupă',
      sortValue: row => {
        const group = groups.find(g => g.id === row.groupId);
        return group ? groupOrderIndex(group, groups) : null;
      },
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
      sortValue: row => (Number.isFinite(row.dueDay) ? row.dueDay : null),
      render: row => row.dueDateLabel,
    },
    {
      key: 'payment',
      header: `Plată ${currentMonthName}`,
      sortValue: row => (row.payment ? PAYMENT_SORT_RANK[row.payment.tone] : 1.5),
      render: row =>
        row.payment && (
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
