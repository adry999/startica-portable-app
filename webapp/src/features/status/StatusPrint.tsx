import type { KindergartenSettings } from '@shared/api/useKindergarten';
import { PrintFooter, PrintHeader, PrintTable, type PrintTableColumn } from '@shared/ui';
import { formatDate, formatMonthLabel } from '#shared/format/date-format.mjs';
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

const AMOUNT_CELL_STYLE = { textAlign: 'right', whiteSpace: 'nowrap' } as const;

/** Situația plăților tipărită (16c) — vizibilă doar în @media print, vezi StatusPage.module.css. */
export function StatusPrint({
  month,
  asOf,
  filterLabel,
  rows,
  showPhone,
  orientation,
  kindergarten,
}: StatusPrintProps) {
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

  const columns: PrintTableColumn<StatusRowView>[] = [
    { key: 'nr', header: 'Nr.', render: row => rows.indexOf(row) + 1 },
    { key: 'copil', header: 'Copil', render: row => (row.archived ? `${row.name} (arhivat)` : row.name) },
    { key: 'parinte', header: 'Părinte', render: row => row.parent || '—' },
    ...(showPhone ? [{ key: 'telefon', header: 'Telefon', render: (row: StatusRowView) => row.phone || '—' }] : []),
    { key: 'scad', header: 'Scad.', render: row => formatDate(row.due) },
    { key: 'taxa', header: 'Taxă', align: 'end', render: row => formatMoney(row.expected, row.currency) },
    { key: 'achitat', header: 'Achitat', align: 'end', render: row => formatMoney(row.paid, row.currency) },
    {
      key: 'rest',
      header: 'Rest',
      align: 'end',
      render: row => <strong>{formatMoney(row.rest, row.currency)}</strong>,
    },
    { key: 'statut', header: 'Statut', render: row => row.label },
  ];

  return (
    <div className={styles.printSheet}>
      <style>{`@page { size: A4 ${orientation}; margin: 12mm; }`}</style>
      <PrintHeader
        title={`Situația plăților · ${formatMonthLabel(month)}`}
        subtitle={`Situație la ${formatDate(asOf)} · filtru: ${filterLabel}`}
        aside={
          <>
            <span>{kindergarten?.displayName || kindergarten?.name || 'Startica'}</span>
            {kindergarten?.idno && <span>IDNO {kindergarten.idno}</span>}
          </>
        }
      />

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

      <PrintTable
        columns={columns}
        rows={rows}
        rowKey={row => row.id}
        rowClassName={row => ((row.rest ?? 0) > 0 ? styles.printRowUnpaid : undefined)}
        footer={
          <tr>
            <td colSpan={showPhone ? 2 : 1}></td>
            <td colSpan={showPhone ? 2 : 1}>Total · {rows.length} copii</td>
            <td></td>
            <td style={AMOUNT_CELL_STYLE}>{formatMoney(expectedTotal)}</td>
            <td style={AMOUNT_CELL_STYLE}>{formatMoney(paidTotal)}</td>
            <td style={AMOUNT_CELL_STYLE}>{formatMoney(restTotal)}</td>
            <td></td>
          </tr>
        }
      />

      <PrintFooter>
        Sume în lei. Taxă integrală pentru luna începută; plățile cu dată viitoare nu intră în soldul de azi.
      </PrintFooter>
    </div>
  );
}
