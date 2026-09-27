import { formatMoney } from '#shared/format/money-format.mjs';
import type { AccountingReport } from './useAccountingReport';
import styles from './ReportPrintSummary.module.css';

export interface ReportPrintSummaryProps {
  report: AccountingReport;
}

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
      <table className={styles.table}>
        <tbody>
          {report.byMethod.map(entry => (
            <tr key={entry.method}>
              <td>{entry.method}</td>
              <td className={styles.alignEnd}>{formatMoney(entry.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className={styles.sectionTitle}>Cheltuieli pe categorii</h2>
      <table className={styles.table}>
        <tbody>
          {report.byCategory.map(entry => (
            <tr key={entry.category}>
              <td>{entry.category}</td>
              <td className={styles.alignEnd}>{formatMoney(entry.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
