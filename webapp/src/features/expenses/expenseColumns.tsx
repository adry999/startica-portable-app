import { Badge, RowMenu, type BadgeTone, type DataTableColumn } from '@shared/ui';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { categoryStyleFor } from './useExpenses';
import type { Expense } from '@contracts/record-types.mjs';
import styles from './ExpensesPage.module.css';

// Aceleași tonuri ca la achitări (PaymentsPage.METHOD_TONE), doar cu valori lowercase.
export const METHOD_TONE: Record<string, BadgeTone> = { cash: 'orange', card: 'yellow', transfer: 'mint' };
export const METHOD_LABEL: Record<string, string> = { cash: 'Cash', card: 'Card', transfer: 'Transfer' };

export interface ExpenseColumnsOptions {
  onEdit: (expense: Expense) => void;
  onToggleArchived: (expense: Expense) => void;
  onRequestDelete: (expense: Expense) => void;
}

export function buildExpenseColumns({
  onEdit,
  onToggleArchived,
  onRequestDelete,
}: ExpenseColumnsOptions): DataTableColumn<Expense>[] {
  return [
    { key: 'date', header: 'Data', sortValue: expense => expense.date, render: expense => formatDate(expense.date) },
    {
      key: 'description',
      header: 'Descriere/furnizor',
      sortValue: expense => expense.description,
      render: expense => (
        <div className={styles.descCell}>
          <span className={styles.descPrimary}>{expense.description || '—'}</span>
          {expense.notes && <span className={styles.descNotes}>{expense.notes}</span>}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Categorie',
      sortValue: expense => expense.category,
      render: expense => <Badge tone={categoryStyleFor(expense.category).tone}>{expense.category}</Badge>,
    },
    {
      key: 'method',
      header: 'Metodă',
      sortValue: expense => expense.method ?? '',
      render: expense => (
        <span className={styles.methodText}>{expense.method ? METHOD_LABEL[expense.method] : '—'}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Sumă',
      align: 'end',
      sortValue: expense => expense.amount,
      render: expense => <strong>{formatMoney(expense.amount)}</strong>,
    },
    {
      key: 'menu',
      header: '',
      align: 'end',
      render: expense => (
        <RowMenu
          items={[
            { label: 'Editează', onClick: () => onEdit(expense) },
            {
              label: expense.archived ? 'Reactivează' : 'Arhivează',
              onClick: () => onToggleArchived(expense),
            },
            {
              label: 'Șterge definitiv',
              danger: true,
              disabled: !expense.archived,
              title: expense.archived ? undefined : 'Arhivează întâi cheltuiala',
              onClick: () => onRequestDelete(expense),
            },
          ]}
        />
      ),
    },
  ];
}
