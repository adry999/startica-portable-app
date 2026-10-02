import { useEffect, useState } from 'react';
import { Button, Card, Kpi, PrintTable } from '@shared/ui';
import { formatMoney } from '#shared/format/money-format.mjs';
import type { DayMethodTotals } from './useDayClosingReceipt';
import styles from './CashSummaryCard.module.css';

export interface CashSummaryCardViewProps {
  status: 'loading' | 'ready';
  dateLabel: string;
  paymentCount: number;
  totalsByMethod: DayMethodTotals;
  /** 44c: clic pe un mini-card de metodă filtrează lista de dedesubt (metodă + ziua asta). */
  onFilterMethod?: (method: keyof DayMethodTotals) => void;
}

const METHOD_TONE = { Cash: 'orange', Card: 'blue', Transfer: 'mint' } as const;
const METHOD_LABEL: Record<keyof DayMethodTotals, string> = { Cash: 'Numerar', Card: 'Card', Transfer: 'Transfer' };
const METHODS: (keyof DayMethodTotals)[] = ['Cash', 'Card', 'Transfer'];

/**
 * 44c: partea prezentațională a „Casa de azi” — fără acces direct la sesiune, ca să poată fi
 * randată simplu în teste/Storybook cu date fixe (`CashSummaryCard` o leagă de
 * `useDayClosingReceipt`). Raportul tipărit e o pagină A4 (`PrintTable`), distinctă de bonul
 * termic al zilei (§11, `DayClosingReceipt`) — vezi `docs/design/INTREBARI.md` dacă diverg vizual.
 */
export function CashSummaryCardView({
  status,
  dateLabel,
  paymentCount,
  totalsByMethod,
  onFilterMethod,
}: CashSummaryCardViewProps) {
  const total = totalsByMethod.Cash + totalsByMethod.Card + totalsByMethod.Transfer;
  // Raportul A4 se montează doar cât timp se tipărește — nu stă tot timpul în DOM (ar dubla
  // rolul „table” pentru orice interogare de pe ecran, cu sau fără CSS aplicat).
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return;
    window.print();
    setPrinting(false);
  }, [printing]);

  if (status === 'loading') {
    return (
      <Card tone="white" className={styles.root}>
        <div className={styles.header}>
          <Kpi label="" value="" state="loading" className={styles.dayKpi} />
        </div>
        <div className={styles.methods}>
          {METHODS.map(method => (
            <Kpi key={method} label="" value="" state="loading" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card tone="white" className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.day}>{dateLabel}</h2>
        <span className={styles.count}>
          {paymentCount} {paymentCount === 1 ? 'achitare' : 'achitări'}
        </span>
      </div>

      <div className={styles.methods}>
        {METHODS.map(method => (
          <Kpi
            key={method}
            tone={METHOD_TONE[method]}
            label={METHOD_LABEL[method]}
            value={formatMoney(totalsByMethod[method])}
            onClick={onFilterMethod ? () => onFilterMethod(method) : undefined}
          />
        ))}
      </div>

      <div className={styles.footer}>
        <span className={styles.totalLabel}>Total</span>
        <strong className={styles.totalValue}>{formatMoney(total)}</strong>
        {paymentCount > 0 && (
          <Button variant="link" className={styles.printLink} onClick={() => setPrinting(true)}>
            Tipărește raportul zilei
          </Button>
        )}
      </div>

      {printing && <CashDayPrintReport dateLabel={dateLabel} totalsByMethod={totalsByMethod} total={total} />}
    </Card>
  );
}

interface CashDayPrintReportProps {
  dateLabel: string;
  totalsByMethod: DayMethodTotals;
  total: number;
}

interface PrintRow {
  method: string;
  amount: number;
}

/** Pagina A4 a raportului zilei — ascunsă pe ecran, arătată doar la `window.print()` (ca
 * `ReportPrintSummary`, `features/report/`). Distinctă de bonul termic (§11, `DayClosingReceipt`). */
function CashDayPrintReport({ dateLabel, totalsByMethod, total }: CashDayPrintReportProps) {
  const rows: PrintRow[] = METHODS.map(method => ({ method: METHOD_LABEL[method], amount: totalsByMethod[method] }));
  return (
    <div className={styles.printPage}>
      <h1 className={styles.printTitle}>Casa de azi</h1>
      <p className={styles.printPeriod}>{dateLabel}</p>
      <PrintTable<PrintRow>
        showHeader={false}
        className={styles.printTable}
        columns={[
          { key: 'method', header: '', render: row => row.method },
          { key: 'amount', header: '', align: 'end', render: row => formatMoney(row.amount) },
        ]}
        rows={rows}
        rowKey={row => row.method}
        footer={
          <tr>
            <td>Total</td>
            <td className={styles.printTotalCell}>{formatMoney(total)}</td>
          </tr>
        }
      />
    </div>
  );
}
