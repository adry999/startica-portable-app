import { Card } from '@shared/ui';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { AccountingReport, ReportMode } from './useAccountingReport';
import styles from './ReportDaysTable.module.css';

export interface ReportDaysTableProps {
  report: AccountingReport;
  mode: ReportMode;
  onOpenPayments: () => void;
}

const TOTAL_LABEL: Record<ReportMode, string> = { month: 'Total lună', quarter: 'Total trimestru', year: 'Total an' };

function formatSigned(amount: number): string {
  return `${amount < 0 ? '−' : '+'}${formatMoney(Math.abs(amount))}`;
}

/** Tabelul „Pe zile” (19a) — doar zilele cu mișcări, cu rândul Total la final. */
export function ReportDaysTable({ report, mode, onOpenPayments }: ReportDaysTableProps) {
  const totals = report.days.reduce(
    (sum, day) => ({
      cash: sum.cash + day.cash,
      cardTransfer: sum.cardTransfer + day.cardTransfer,
      expense: sum.expense + day.expense,
      balance: sum.balance + day.balance,
    }),
    { cash: 0, cardTransfer: 0, expense: 0, balance: 0 },
  );

  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <span className={styles.title}>Pe zile</span>
        <span className={styles.hint}>doar zilele cu mișcări</span>
        <button type="button" className={styles.link} onClick={onOpenPayments}>
          Deschide în Achitări →
        </button>
      </div>
      <div className={styles.headRow}>
        <span>Data</span>
        <span className={styles.alignEnd}>Cash</span>
        <span className={styles.alignEnd}>Card + transfer</span>
        <span className={styles.alignEnd}>Cheltuieli</span>
        <span className={styles.alignEnd}>Sold zi</span>
      </div>
      {report.days.map(day => (
        <div key={day.date} className={styles.row}>
          <span className={styles.date}>{formatDate(day.date)}</span>
          <span className={styles.alignEnd}>{formatMoney(day.cash)}</span>
          <span className={styles.alignEnd}>{formatMoney(day.cardTransfer)}</span>
          <span className={`${styles.alignEnd} ${styles.expense}`}>
            {day.expense > 0 ? `−${formatMoney(day.expense)}` : formatMoney(0)}
          </span>
          <span className={`${styles.alignEnd} ${styles.balance}`}>{formatSigned(day.balance)}</span>
        </div>
      ))}
      {!report.days.length && <p className={styles.empty}>Nicio mișcare în această perioadă.</p>}
      <div className={styles.totalRow}>
        <span>{TOTAL_LABEL[mode]}</span>
        <span className={styles.alignEnd}>{formatMoney(totals.cash)}</span>
        <span className={styles.alignEnd}>{formatMoney(totals.cardTransfer)}</span>
        <span className={`${styles.alignEnd} ${styles.expense}`}>
          {totals.expense > 0 ? `−${formatMoney(totals.expense)}` : formatMoney(0)}
        </span>
        <span className={styles.alignEnd}>{formatSigned(totals.balance)}</span>
      </div>
    </Card>
  );
}
