import { Badge } from '@shared/ui';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { categoryStyleFor } from './useExpenses';
import type { Expense } from '@contracts/record-types.mjs';
import styles from './ExpensesPage.module.css';

export interface DailyGroup {
  date: string;
  items: Expense[];
  dayTotal: number;
}

/**
 * Vizualizare simplă „Pe zile", fără coloana de buget — bugetul pe categorii e
 * o funcție nouă, explicit în afara scopului (vezi README-ul redesign-ului).
 */
export function DailyExpensesView({ groups }: { groups: DailyGroup[] }) {
  if (groups.length === 0) return <p className={styles.notice}>Nu există înregistrări pentru filtrele alese.</p>;

  return (
    <div className={styles.dailyList}>
      {groups.map(group => (
        <div key={group.date} className={styles.dayGroup}>
          <div className={styles.dayHead}>
            <strong>{formatDate(group.date)}</strong>
            <span>{formatMoney(group.dayTotal)}</span>
          </div>
          {group.items.map(expense => (
            <div key={expense.id} className={styles.dayRow}>
              <span className={styles.dayRowDesc}>{expense.description || '—'}</span>
              <Badge tone={categoryStyleFor(expense.category).tone}>{expense.category}</Badge>
              <span className={styles.dayRowAmount}>{formatMoney(expense.amount)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
