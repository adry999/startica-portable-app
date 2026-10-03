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
  // Totalurile se țin separat pe monedă — a le aduna direct ar amesteca MDL și EUR ca și cum
  // ar fi aceeași unitate (12c/StatusPrint, aceeași regulă ca în Situația plăților pe ecran).
  let expectedTotalMdl = 0;
  let paidTotalMdl = 0;
  let restTotalMdl = 0;
  let expectedTotalEur = 0;
  let paidTotalEur = 0;
  let restTotalEur = 0;
  let hasEur = false;
  let overdueCount = 0;
  let partialCount = 0;
  for (const row of rows) {
    if (row.currency === 'EUR') {
      hasEur = true;
      expectedTotalEur += row.expected ?? 0;
      paidTotalEur += row.paid ?? 0;
      restTotalEur += row.rest ?? 0;
    } else {
      expectedTotalMdl += row.expected ?? 0;
      paidTotalMdl += row.paid ?? 0;
      restTotalMdl += row.rest ?? 0;
    }
    if (row.label === 'Restanță') overdueCount += 1;
    if (row.label === 'Plată parțială') partialCount += 1;
  }
  function totalLabel(mdl: number, eur: number): string {
    return hasEur ? `${formatMoney(mdl)} + ${formatMoney(eur, 'EUR')}` : formatMoney(mdl);
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
          <strong>{totalLabel(expectedTotalMdl, expectedTotalEur)}</strong>
        </div>
        <div className={styles.printSummaryCell}>
          <span>Încasat</span>
          <strong>{totalLabel(paidTotalMdl, paidTotalEur)}</strong>
        </div>
        <div className={styles.printSummaryCell}>
          <span>Rest</span>
          <strong>{totalLabel(restTotalMdl, restTotalEur)}</strong>
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
            <td style={AMOUNT_CELL_STYLE}>{totalLabel(expectedTotalMdl, expectedTotalEur)}</td>
            <td style={AMOUNT_CELL_STYLE}>{totalLabel(paidTotalMdl, paidTotalEur)}</td>
            <td style={AMOUNT_CELL_STYLE}>{totalLabel(restTotalMdl, restTotalEur)}</td>
            <td></td>
          </tr>
        }
      />

      <PrintFooter>
        {hasEur
          ? 'Sume în moneda fiecărui copil (lei sau €); totalurile de mai sus sunt separate pe monedă, nu adunate. '
          : 'Sume în lei. '}
        Taxă integrală pentru luna începută; plățile cu dată viitoare nu intră în soldul de azi.
      </PrintFooter>
    </div>
  );
}
