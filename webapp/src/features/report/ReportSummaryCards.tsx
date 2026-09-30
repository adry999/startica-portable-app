import { Kpi } from '@shared/ui';
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
      <Kpi
        tone="mint"
        decorative
        size="lg"
        className={styles.card}
        label={`Încasări · ${report.incomeCount} achitări`}
        value={formatMoney(report.income)}
      />
      <Kpi
        tone="pink"
        decorative
        size="lg"
        className={styles.card}
        label={`Cheltuieli · ${report.expenseCount}`}
        value={formatMoney(report.expense)}
      />
      <Kpi
        tone="white"
        size="lg"
        className={`${styles.card} ${styles.soldCard}`}
        label="Sold al perioadei"
        value={formatSigned(report.balance)}
      />
    </div>
  );
}
