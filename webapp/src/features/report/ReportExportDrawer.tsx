import { useState } from 'react';
import { Button, Drawer, useToast } from '@shared/ui';
import { formatDate } from '#shared/format/date-format.mjs';
import { reportPeriodBounds } from '#features/report/index.web.mjs';
import { downloadAccountingReportExcel, reportExportFilename } from './report-excel';
import { ReportPrintSummary } from './ReportPrintSummary';
import type { AccountingReportData, ReportPeriod } from './useAccountingReport';
import styles from './ReportExportDrawer.module.css';

export interface ReportExportDrawerProps {
  open: boolean;
  onClose: () => void;
  anchorMonth: string;
  data: AccountingReportData;
  onOpenAssign: () => void;
}

type ExportPeriodKind = 'month' | 'quarter' | 'year' | 'interval';
type ExportFormat = 'excel' | 'pdf';

/** Panoul lateral „Exportă pentru contabil” (19b) — v1 fără selector de filială, vezi INTREBARI.md. */
export function ReportExportDrawer({ open, onClose, anchorMonth, data, onOpenAssign }: ReportExportDrawerProps) {
  const toast = useToast();
  const [periodKind, setPeriodKind] = useState<ExportPeriodKind>('month');
  const [intervalFrom, setIntervalFrom] = useState(anchorMonth + '-01');
  const [intervalTo, setIntervalTo] = useState(anchorMonth + '-01');
  const [format, setFormat] = useState<ExportFormat>('excel');
  const [includePayerNames, setIncludePayerNames] = useState(true);
  const [includeEurDetails, setIncludeEurDetails] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [exporting, setExporting] = useState(false);

  const monthPeriod = reportPeriodBounds('month', anchorMonth) as ReportPeriod;
  const quarterPeriod = reportPeriodBounds('quarter', anchorMonth) as ReportPeriod;
  const yearPeriod = reportPeriodBounds('year', anchorMonth) as ReportPeriod;
  const intervalPeriod: ReportPeriod = {
    from: intervalFrom,
    to: intervalTo,
    label: `${formatDate(intervalFrom)} – ${formatDate(intervalTo)}`,
  };
  const period =
    periodKind === 'month'
      ? monthPeriod
      : periodKind === 'quarter'
        ? quarterPeriod
        : periodKind === 'year'
          ? yearPeriod
          : intervalPeriod;

  const report = data.buildForPeriod(period, { includeArchived });
  const options = { includePayerNames, includeEurDetails };

  async function handleExport() {
    setExporting(true);
    try {
      if (format === 'excel') {
        await downloadAccountingReportExcel(report, options);
        toast.show({ message: 'Fișierul Excel a fost descărcat.' });
      } else {
        window.print();
      }
      onClose();
    } catch {
      toast.show({ message: 'Exportul nu a putut fi generat.' });
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Drawer
        open={open}
        title="Exportă pentru contabil"
        width={520}
        onClose={onClose}
        footer={
          <div className={styles.footer}>
            <span className={styles.filename}>
              {format === 'excel' ? reportExportFilename(period) : `Rezumatul lunii — se tipărește ca PDF`}
            </span>
            <Button variant="outline" onClick={onClose}>
              Renunță
            </Button>
            <Button disabled={exporting} onClick={() => void handleExport()}>
              {format === 'excel' ? 'Descarcă' : 'Tipărește'}
            </Button>
          </div>
        }
      >
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Perioada</span>
          <div className={styles.pills}>
            <button
              type="button"
              className={periodKind === 'month' ? styles.pillActive : styles.pill}
              onClick={() => setPeriodKind('month')}
            >
              {monthPeriod.label}
            </button>
            <button
              type="button"
              className={periodKind === 'quarter' ? styles.pillActive : styles.pill}
              onClick={() => setPeriodKind('quarter')}
            >
              {quarterPeriod.label}
            </button>
            <button
              type="button"
              className={periodKind === 'year' ? styles.pillActive : styles.pill}
              onClick={() => setPeriodKind('year')}
            >
              {yearPeriod.label}
            </button>
            <button
              type="button"
              className={periodKind === 'interval' ? styles.pillActive : styles.pill}
              onClick={() => setPeriodKind('interval')}
            >
              Altă perioadă…
            </button>
          </div>
          {periodKind === 'interval' && (
            <div className={styles.intervalInputs}>
              <input
                type="date"
                aria-label="De la data"
                value={intervalFrom}
                onChange={event => setIntervalFrom(event.target.value)}
              />
              <span>–</span>
              <input
                type="date"
                aria-label="Până la data"
                value={intervalTo}
                onChange={event => setIntervalTo(event.target.value)}
              />
            </div>
          )}
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Format</span>
          <div className={styles.formatGrid}>
            <button
              type="button"
              className={format === 'excel' ? styles.formatCardActive : styles.formatCard}
              onClick={() => setFormat('excel')}
            >
              <span className={styles.formatTitle}>Excel (.xlsx)</span>
              <span className={styles.formatHint}>Foi: Rezumat, Încasări, Cheltuieli. Un rând pe operațiune.</span>
            </button>
            <button
              type="button"
              className={format === 'pdf' ? styles.formatCardActive : styles.formatCard}
              onClick={() => setFormat('pdf')}
            >
              <span className={styles.formatTitle}>PDF</span>
              <span className={styles.formatHint}>Rezumatul perioadei pe o pagină A4.</span>
            </button>
          </div>
        </div>

        <div className={styles.checkboxes}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={includePayerNames}
              onChange={event => setIncludePayerNames(event.target.checked)}
            />
            <span>Include numele plătitorilor</span>
          </label>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={includeEurDetails}
              onChange={event => setIncludeEurDetails(event.target.checked)}
            />
            <span>Sumele în EUR cu cursul și echivalentul în lei</span>
          </label>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={event => setIncludeArchived(event.target.checked)}
            />
            <span>Include achitările arhivate</span>
          </label>
        </div>

        {report.unassignedCount > 0 && (
          <div className={styles.warning}>
            <span>
              <b>
                {report.unassignedCount} {report.unassignedCount === 1 ? 'achitare neasociată' : 'achitări neasociate'}
              </b>{' '}
              în perioada aleasă apar în foaia Încasări cu copilul „—”.{' '}
              <button type="button" className={styles.warningLink} onClick={onOpenAssign}>
                Asociază-le întâi →
              </button>
            </span>
          </div>
        )}
      </Drawer>
      <ReportPrintSummary report={report} />
    </>
  );
}
