import { BnmRateLink, Card } from '@shared/ui';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatRate } from '#shared/format/rate-format.mjs';
import type { AccountingReport } from './useAccountingReport';
import styles from './ReportMethodsPanel.module.css';

export interface ReportMethodsPanelProps {
  report: AccountingReport;
}

/** Panoul „Încasări pe metode” + lista „Pentru taxe în EUR” (19a) — cursul e cel salvat pe achitare, nu recalculat. */
export function ReportMethodsPanel({ report }: ReportMethodsPanelProps) {
  return (
    <Card className={styles.panel}>
      <span className={styles.title}>Încasări pe metode</span>
      <div className={styles.methods}>
        {report.byMethod.map(entry => (
          <div key={entry.method} className={styles.methodRow}>
            <div className={styles.methodHead}>
              <span className={styles.methodLabel}>{entry.method}</span>
              <span className={styles.methodCount}>{entry.count} mișcări</span>
              <span className={styles.methodValue}>{formatMoney(entry.amount)}</span>
            </div>
            <span className={styles.bar}>
              <span className={styles.barFill} style={{ width: `${Math.round(entry.percent)}%` }} />
            </span>
          </div>
        ))}
        {!report.byMethod.length && <p className={styles.empty}>Nicio încasare în această perioadă.</p>}
      </div>

      {report.eurRows.length > 0 && (
        <div className={styles.eurSection}>
          <div className={styles.eurHead}>
            <span className={styles.eurTitle}>Pentru taxe în EUR</span>
            <span className={styles.eurHint}>{report.eurRows.length} achitări, la cursul zilei lor</span>
            <span className={styles.eurTotal}>
              {formatMoney(report.eurTotalLei)} = {formatMoney(report.eurTotalEur, 'EUR')}
            </span>
          </div>
          <div className={styles.eurTableHead}>
            <span>Data</span>
            <span>Copil</span>
            <span className={styles.alignEnd}>Lei</span>
            <span className={styles.alignEnd}>Curs</span>
            <span className={styles.alignEnd}>EUR</span>
          </div>
          {report.eurRows.map(row => (
            <div key={row.id} className={styles.eurRow}>
              <span className={styles.eurDate}>{formatDate(row.date)}</span>
              <span className={styles.eurChild}>{row.childLabel}</span>
              <span className={styles.alignEnd}>{formatMoney(row.amount)}</span>
              <span className={row.fxRateSource === 'manual' ? styles.eurRateManual : styles.alignEnd}>
                {formatRate(row.fxRate)}
                <BnmRateLink date={row.date} />
              </span>
              <span className={`${styles.alignEnd} ${styles.eurAmount}`}>{formatMoney(row.amountEur, 'EUR')}</span>
            </div>
          ))}
          <p className={styles.eurNote}>
            Cursul se ia automat din BNM în ziua achitării și rămâne salvat pe achitare. Cursurile zilelor se văd și se
            corectează în Backup și setări → Planuri și curs; cursul unei singure achitări se corectează din achitare.{' '}
            <span className={styles.eurNoteManual}>Portocaliu</span> = curs corectat manual.
          </p>
        </div>
      )}
    </Card>
  );
}
