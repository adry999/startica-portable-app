import { useEffect, useState } from 'react';
import { Button, Drawer, useToast } from '@shared/ui';
import { formatDate } from '#shared/format/date-format.mjs';
import { reportPeriodBounds } from '#features/report/index.web.mjs';
import { fetchBranches, fetchBranchRecords, type BranchSummary } from '@shared/api/branches';
import {
  downloadAccountingReportExcel,
  downloadMultiBranchReportExcel,
  reportExportFilename,
  reportExportFilenameAmbele,
  type MultiBranchReportEntry,
} from './report-excel';
import { ReportPrintSummary } from './ReportPrintSummary';
import { buildForRecords, type AccountingReportData, type ReportPeriod } from './useAccountingReport';
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
type BranchFilter = 'current' | 'both';

/** Panoul lateral „Exportă pentru contabil” (19b). Filiala apare doar cu mai multe filiale (17-filiale.md, Faza 4). */
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
  const [branchFilter, setBranchFilter] = useState<BranchFilter>('current');
  const [activeBranchId, setActiveBranchId] = useState('');
  const [branchesList, setBranchesList] = useState<BranchSummary[]>([]);

  // Listă citită doar când panoul se deschide, ca la dropdown-ul selectorului (13a) —
  // nu are rost cerută în fiecare randare a ecranului Raport contabil.
  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const response = await fetchBranches();
        setActiveBranchId(response.activeBranchId);
        setBranchesList(response.branches);
      } catch {
        setBranchesList([]);
      }
    })();
  }, [open]);

  const currentBranch = branchesList.find(branch => branch.id === activeBranchId);
  const otherBranches = branchesList.filter(branch => branch.id !== activeBranchId);
  const hasMultipleBranches = branchesList.length > 1;
  const exportingBoth = format === 'excel' && branchFilter === 'both' && hasMultipleBranches;

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
        if (exportingBoth) {
          const entries: MultiBranchReportEntry[] = [{ branchName: currentBranch?.name ?? 'Filiala curentă', report }];
          for (const branch of otherBranches) {
            const otherRecords = await fetchBranchRecords(branch.id);
            entries.push({
              branchName: branch.name,
              report: buildForRecords(otherRecords, period, { includeArchived }),
            });
          }
          await downloadMultiBranchReportExcel(entries, options, period);
          toast.show({ message: 'Fișierul Excel a fost descărcat (ambele filiale).' });
        } else {
          await downloadAccountingReportExcel(report, options);
          toast.show({ message: 'Fișierul Excel a fost descărcat.' });
        }
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
              {format === 'excel'
                ? exportingBoth
                  ? reportExportFilenameAmbele(period)
                  : reportExportFilename(period)
                : `Rezumatul lunii — se tipărește ca PDF`}
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

        {hasMultipleBranches && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Filiala</span>
            <div className={styles.branchOptions}>
              <label className={styles.branchOption}>
                <input
                  type="radio"
                  name="branchFilter"
                  checked={branchFilter === 'current'}
                  disabled={format === 'pdf'}
                  onChange={() => setBranchFilter('current')}
                />
                <span>{currentBranch?.name ?? 'Filiala curentă'}</span>
              </label>
              <label className={styles.branchOption}>
                <input
                  type="radio"
                  name="branchFilter"
                  checked={branchFilter === 'both'}
                  disabled={format === 'pdf'}
                  onChange={() => setBranchFilter('both')}
                />
                <span>Ambele (o foaie pe filială)</span>
              </label>
            </div>
            {format === 'pdf' && <p className={styles.hint}>PDF-ul tipărește filiala deschisă.</p>}
          </div>
        )}

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
