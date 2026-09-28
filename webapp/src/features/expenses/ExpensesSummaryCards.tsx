import { Card } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { CategorySummaryItem } from './useExpenses';
import styles from './ExpensesPage.module.css';

const MONTH_NAMES = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
];

function monthName(monthKey: string): string {
  return MONTH_NAMES[Number(monthKey.slice(5, 7)) - 1] ?? monthKey;
}

export interface ExpensesSummaryCardsProps {
  month: string;
  monthTotal: number;
  monthExpenseCount: number;
  categorySummary: CategorySummaryItem[];
}

export function ExpensesSummaryCards({
  month,
  monthTotal,
  monthExpenseCount,
  categorySummary,
}: ExpensesSummaryCardsProps) {
  const noun = monthExpenseCount === 1 ? 'cheltuială' : 'cheltuieli';

  return (
    <div className={styles.kpiRow}>
      <Card tone="mint" decorative className={styles.kpiCard}>
        <p className={`${styles.kpiLabel} ${styles.kpiLabelTotal}`}>
          Total {monthName(month)} · {monthExpenseCount} {noun}
        </p>
        <strong className={styles.kpiValue}>{formatMoney(monthTotal)}</strong>
      </Card>

      <Card className={styles.categoryCard}>
        <p className={styles.kpiLabel}>Pe categorii, luna curentă</p>
        <div className={styles.categoryBar}>
          {categorySummary
            .filter(item => item.amount > 0)
            .map(item => (
              <span
                key={item.label}
                className={styles.categorySegment}
                style={{ width: `${item.percent}%`, background: item.color }}
              />
            ))}
        </div>
        <div className={styles.categoryLegend}>
          {categorySummary.map(item => (
            <div key={item.label} className={styles.categoryLegendItem}>
              <span className={styles.categoryLegendName}>
                <span className={styles.categoryDot} style={{ background: item.color }} />
                {item.label}
              </span>
              <strong className={styles.categoryLegendSum}>{formatMoney(item.amount)}</strong>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
