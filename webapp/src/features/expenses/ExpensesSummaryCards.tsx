import { Card } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { CategorySummaryItem } from './useExpenses';
import styles from './ExpensesPage.module.css';

export interface ExpensesSummaryCardsProps {
  monthTotal: number;
  categorySummary: CategorySummaryItem[];
}

export function ExpensesSummaryCards({ monthTotal, categorySummary }: ExpensesSummaryCardsProps) {
  return (
    <div className={styles.kpiRow}>
      <Card tone="mint" decorative className={styles.kpiCard}>
        <p className={styles.kpiLabel}>Total lună</p>
        <strong className={styles.kpiValue}>{formatMoney(monthTotal)}</strong>
      </Card>

      <Card className={styles.categoryCard}>
        <p className={styles.kpiLabel}>Pe categorii, luna curentă</p>
        <div className={styles.categoryBar}>
          {categorySummary
            .filter(item => item.amount > 0)
            .map(item => (
              <span key={item.label} style={{ width: `${item.percent}%`, background: item.color }} />
            ))}
        </div>
        <div className={styles.categoryLegend}>
          {categorySummary.map(item => (
            <div key={item.label} className={styles.categoryLegendItem}>
              <span className={styles.categoryDot} style={{ background: item.color }} />
              <span>{item.label}</span>
              <strong>{formatMoney(item.amount)}</strong>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
