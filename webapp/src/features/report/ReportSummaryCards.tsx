import { Card } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { AccountingReport } from './useAccountingReport';
import styles from './ReportSummaryCards.module.css';

export interface ReportSummaryCardsProps {
  report: AccountingReport;
}

function formatSigned(amount: number): string {
  return `${amount < 0 ? '−' : '+'}${formatMoney(Math.abs(amount))}`;
}

/** 3 carduri KPI: Încasări (mint), Cheltuieli (pink), Sold (contur, cu semn) — vezi 19a. */
export function ReportSummaryCards({ report }: ReportSummaryCardsProps) {
  return (
    <div className={styles.row}>
      <Card tone="mint" decorative className={styles.card}>
        <span className={styles.mintLabel}>Încasări · {report.incomeCount} achitări</span>
        <strong className={styles.value}>{formatMoney(report.income)}</strong>
      </Card>
      <Card tone="pink" decorative className={styles.card}>
        <span className={styles.pinkLabel}>Cheltuieli · {report.expenseCount}</span>
        <strong className={styles.value}>{formatMoney(report.expense)}</strong>
      </Card>
      <Card tone="white" className={`${styles.card} ${styles.soldCard}`}>
        <span className={styles.soldLabel}>Sold al perioadei</span>
        <strong className={styles.value}>{formatSigned(report.balance)}</strong>
      </Card>
    </div>
  );
}
