import { useState } from 'react';
import { Button, LoadingState, SegmentedControl, useTopbarActions } from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { PeriodStepper } from './PeriodStepper';
import { ReportSummaryCards } from './ReportSummaryCards';
import { ReportMethodsPanel } from './ReportMethodsPanel';
import { ReportCategoriesPanel } from './ReportCategoriesPanel';
import { ReportDaysTable } from './ReportDaysTable';
import { ReportExportDrawer } from './ReportExportDrawer';
import { useAccountingReport, type ReportMode } from './useAccountingReport';
import styles from './ReportPage.module.css';

export interface ReportPageProps {
  month: string;
  onMonthChange: (month: string) => void;
  onOpenPayments: () => void;
  onOpenAssign: () => void;
}

const MODE_OPTIONS = [
  { value: 'month', label: 'Lună' },
  { value: 'quarter', label: 'Trimestru' },
  { value: 'year', label: 'An' },
] as const;

/** „Raport contabil” (19a) — doar citire, nu creează date. Vezi docs/design/screens/20-raport-contabil.md. */
export function ReportPage({ month, onMonthChange, onOpenPayments, onOpenAssign }: ReportPageProps) {
  const [mode, setMode] = usePersistedState<ReportMode>('view.report', 'month');
  const data = useAccountingReport(month, mode);
  const [exportOpen, setExportOpen] = useState(false);

  useTopbarActions(
    <div className={styles.headerActions}>
      <SegmentedControl<ReportMode> ariaLabel="Perioadă" value={mode} onChange={setMode} options={MODE_OPTIONS} />
      <PeriodStepper mode={mode} anchorMonth={month} period={data.period} onAnchorMonthChange={onMonthChange} />
      <Button onClick={() => setExportOpen(true)}>Exportă pentru contabil</Button>
    </div>,
  );

  if (data.status === 'loading') return <LoadingState />;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;
  if (!data.report) return null;

  return (
    <>
      <div className={styles.screen}>
        <ReportSummaryCards report={data.report} />
        <div className={styles.panels}>
          <ReportMethodsPanel report={data.report} />
          <ReportCategoriesPanel report={data.report} />
        </div>
        <ReportDaysTable report={data.report} mode={mode} onOpenPayments={onOpenPayments} />
      </div>

      <ReportExportDrawer
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        anchorMonth={month}
        data={data}
        onOpenAssign={onOpenAssign}
      />
    </>
  );
}
