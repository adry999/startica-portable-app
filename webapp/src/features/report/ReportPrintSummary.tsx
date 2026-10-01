import { PrintTable } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { AccountingReport, ReportCategoryRow, ReportMethodRow } from './useAccountingReport';
import styles from './ReportPrintSummary.module.css';

export interface ReportPrintSummaryProps {
  report: AccountingReport;
}

const METHOD_COLUMNS = [
  { key: 'method', header: '', render: (entry: ReportMethodRow) => entry.method },
  { key: 'amount', header: '', align: 'end' as const, render: (entry: ReportMethodRow) => formatMoney(entry.amount) },
];

const CATEGORY_COLUMNS = [
  { key: 'category', header: '', render: (entry: ReportCategoryRow) => entry.category },
  {
    key: 'amount',
    header: '',
    align: 'end' as const,
    render: (entry: ReportCategoryRow) => formatMoney(entry.amount),
  },
];

/**
 * Rezumatul pe o pagină A4, ascuns pe ecran și arătat doar la `window.print()`
 * (vezi `@media print` din modulul CSS) — antetul grădiniței (16a) nu există
 * încă (îl adaugă alt agent în paralel), deci titlul rămâne generic pentru v1.
 */
export function ReportPrintSummary({ report }: ReportPrintSummaryProps) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Raport contabil</h1>
      <p className={styles.period}>{report.period.label}</p>

      <div className={styles.totals}>
        <div>
          <span className={styles.label}>Încasări</span>
          <strong>{formatMoney(report.income)}</strong>
        </div>
        <div>
          <span className={styles.label}>Cheltuieli</span>
          <strong>{formatMoney(report.expense)}</strong>
        </div>
        <div>
          <span className={styles.label}>Sold</span>
          <strong>{formatMoney(report.balance)}</strong>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>Încasări pe metode</h2>
      <PrintTable
        showHeader={false}
        className={styles.table}
        columns={METHOD_COLUMNS}
        rows={report.byMethod}
        rowKey={entry => entry.method}
      />

      <h2 className={styles.sectionTitle}>Cheltuieli pe categorii</h2>
      <PrintTable
        showHeader={false}
        className={styles.table}
        columns={CATEGORY_COLUMNS}
        rows={report.byCategory}
        rowKey={entry => entry.category}
      />
    </div>
  );
}
