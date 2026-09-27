import { Card } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import { reportCategoryStyleFor } from './report-category-style';
import type { AccountingReport } from './useAccountingReport';
import styles from './ReportCategoriesPanel.module.css';

export interface ReportCategoriesPanelProps {
  report: AccountingReport;
}

/** Panoul „Cheltuieli pe categorii” (19a) — culorile din `categoryStyleFor`, cu bara de proporție. */
export function ReportCategoriesPanel({ report }: ReportCategoriesPanelProps) {
  return (
    <Card className={styles.panel}>
      <span className={styles.title}>Cheltuieli pe categorii</span>
      <div className={styles.rows}>
        {report.byCategory.map(entry => {
          const style = reportCategoryStyleFor(entry.category);
          return (
            <div key={entry.category} className={styles.row}>
              <div className={styles.head}>
                <span className={styles.dot} style={{ background: style.color }} />
                <span className={styles.label}>{entry.category}</span>
                <span className={styles.count}>{entry.count} operațiuni</span>
                <span className={styles.value}>{formatMoney(entry.amount)}</span>
              </div>
              <span className={styles.bar}>
                <span
                  className={styles.barFill}
                  style={{ width: `${Math.round(entry.percent)}%`, background: style.color }}
                />
              </span>
            </div>
          );
        })}
        {!report.byCategory.length && <p className={styles.empty}>Nicio cheltuială în această perioadă.</p>}
      </div>
    </Card>
  );
}
