import { useEffect, useState } from 'react';
import { Button, Checkbox, ChipSelect, ChoiceCards, DateInput, Drawer, RadioGroup, useToast } from '@shared/ui';
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
          <ChipSelect<ExportPeriodKind>
            ariaLabel="Perioada"
            value={periodKind}
            onChange={setPeriodKind}
            options={[
              { value: 'month', label: monthPeriod.label },
              { value: 'quarter', label: quarterPeriod.label },
              { value: 'year', label: yearPeriod.label },
              { value: 'interval', label: 'Altă perioadă…' },
            ]}
          />
          {periodKind === 'interval' && (
            <div className={styles.intervalInputs}>
              <DateInput value={intervalFrom} onChange={setIntervalFrom} ariaLabel="De la data" />
              <span aria-hidden="true">–</span>
              <DateInput value={intervalTo} onChange={setIntervalTo} ariaLabel="Până la data" />
            </div>
          )}
        </div>

        {hasMultipleBranches && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Filiala</span>
            <RadioGroup
              name="branchFilter"
              ariaLabel="Filiala"
              disabled={format === 'pdf'}
              value={branchFilter}
              onChange={value => setBranchFilter(value as BranchFilter)}
              options={[
                { value: 'current', label: currentBranch?.name ?? 'Filiala curentă' },
                { value: 'both', label: 'Ambele (o foaie pe filială)' },
              ]}
            />
            {format === 'pdf' && <p className={styles.hint}>PDF-ul tipărește filiala deschisă.</p>}
          </div>
        )}

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Format</span>
          <ChoiceCards<ExportFormat>
            ariaLabel="Format"
            columns={2}
            value={format}
            onChange={setFormat}
            options={[
              {
                value: 'excel',
                title: 'Excel (.xlsx)',
                sub: 'Foi: Rezumat, Încasări, Cheltuieli. Un rând pe operațiune.',
              },
              { value: 'pdf', title: 'PDF', sub: 'Rezumatul perioadei pe o pagină A4.' },
            ]}
          />
        </div>

        <div className={styles.checkboxes}>
          <label className={styles.checkboxRow}>
            <Checkbox
              checked={includePayerNames}
              onChange={setIncludePayerNames}
              ariaLabel="Include numele plătitorilor"
            />
            <span>Include numele plătitorilor</span>
          </label>
          <label className={styles.checkboxRow}>
            <Checkbox
              checked={includeEurDetails}
              onChange={setIncludeEurDetails}
              ariaLabel="Sumele în EUR cu cursul și echivalentul în lei"
            />
            <span>Sumele în EUR cu cursul și echivalentul în lei</span>
          </label>
          <label className={styles.checkboxRow}>
            <Checkbox checked={includeArchived} onChange={setIncludeArchived} ariaLabel="Include achitările arhivate" />
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
              <Button variant="link" onClick={onOpenAssign}>
                Asociază-le întâi →
              </Button>
            </span>
          </div>
        )}
      </Drawer>
      <ReportPrintSummary report={report} />
    </>
  );
}
