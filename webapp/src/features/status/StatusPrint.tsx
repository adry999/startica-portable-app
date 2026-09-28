import type { KindergartenSettings } from '@shared/api/useKindergarten';
import { formatDate, formatDateTime, formatMonthLabel } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { StatusRowView } from './useStatus';
import type { PrintOrientation } from './PrintOptionsDialog';
import styles from './StatusPage.module.css';

export interface StatusPrintProps {
  month: string;
  asOf: string;
  filterLabel: string;
  rows: StatusRowView[];
  showPhone: boolean;
  orientation: PrintOrientation;
  /** Vine de la StatusPage, care ține hook-ul montat din intrarea pe ecran (M4) — StatusPrint nu mai
   * cere singur /api/kindergarten, ca să nu tipărească cu antetul generic înainte ca datele să ajungă. */
  kindergarten: KindergartenSettings | null;
}

/** Situația plăților tipărită (16c) — vizibilă doar în @media print, vezi StatusPage.module.css. */
export function StatusPrint({ month, asOf, filterLabel, rows, showPhone, orientation, kindergarten }: StatusPrintProps) {
  let expectedTotal = 0;
  let paidTotal = 0;
  let restTotal = 0;
  let overdueCount = 0;
  let partialCount = 0;
  for (const row of rows) {
    expectedTotal += row.expected ?? 0;
    paidTotal += row.paid ?? 0;
    restTotal += row.rest ?? 0;
    if (row.label === 'Restanță') overdueCount += 1;
    if (row.label === 'Plată parțială') partialCount += 1;
  }

  return (
    <div className={styles.printSheet}>
      <style>{`@page { size: A4 ${orientation}; margin: 12mm; }`}</style>
      <div className={styles.printHeader}>
        <div className={styles.printTitleBlock}>
          <p className={styles.printTitle}>Situația plăților · {formatMonthLabel(month)}</p>
          <p className={styles.printSubtitle}>
            Situație la {formatDate(asOf)} · filtru: {filterLabel}
          </p>
        </div>
        <div className={styles.printKindergarten}>
          <span>{kindergarten?.displayName || kindergarten?.name || 'Startica'}</span>
          {kindergarten?.idno && <span>IDNO {kindergarten.idno}</span>}
        </div>
      </div>

      <div className={styles.printSummary}>
        <div className={styles.printSummaryCell}>
          <span>De încasat</span>
          <strong>{formatMoney(expectedTotal)}</strong>
        </div>
        <div className={styles.printSummaryCell}>
          <span>Încasat</span>
          <strong>{formatMoney(paidTotal)}</strong>
        </div>
        <div className={styles.printSummaryCell}>
          <span>Rest</span>
          <strong>{formatMoney(restTotal)}</strong>
        </div>
        <div className={styles.printSummaryCell}>
          <span>Copii în listă</span>
          <strong>
            {overdueCount} restanțe · {partialCount} parțial
          </strong>
        </div>
      </div>

      <table className={styles.printTable}>
        <thead>
          <tr>
            <th>Nr.</th>
            <th>Copil</th>
            <th>Părinte</th>
            {showPhone && <th>Telefon</th>}
            <th>Scad.</th>
            <th className={styles.printAmountCol}>Taxă</th>
            <th className={styles.printAmountCol}>Achitat</th>
            <th className={styles.printAmountCol}>Rest</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className={(row.rest ?? 0) > 0 ? styles.printRowUnpaid : undefined}>
              <td>{index + 1}</td>
              <td>{row.archived ? `${row.name} (arhivat)` : row.name}</td>
              <td>{row.parent || '—'}</td>
              {showPhone && <td>{row.phone || '—'}</td>}
              <td>{formatDate(row.due)}</td>
              <td className={styles.printAmountCol}>{formatMoney(row.expected, row.currency)}</td>
              <td className={styles.printAmountCol}>{formatMoney(row.paid, row.currency)}</td>
              <td className={styles.printAmountCol}>
                <strong>{formatMoney(row.rest, row.currency)}</strong>
              </td>
              <td>{row.label}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={showPhone ? 2 : 1}></td>
            <td colSpan={showPhone ? 2 : 1}>Total · {rows.length} copii</td>
            <td></td>
            <td className={styles.printAmountCol}>{formatMoney(expectedTotal)}</td>
            <td className={styles.printAmountCol}>{formatMoney(paidTotal)}</td>
            <td className={styles.printAmountCol}>{formatMoney(restTotal)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div className={styles.printFooter}>
        <span>
          Sume în lei. Taxă integrală pentru luna începută; plățile cu dată viitoare nu intră în soldul de azi.
        </span>
        <span>tipărit la {formatDateTime(new Date().toISOString())}</span>
      </div>
    </div>
  );
}
