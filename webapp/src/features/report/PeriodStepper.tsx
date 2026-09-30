import { IconButton, MonthPicker } from '@shared/ui';
import type { ReportMode, ReportPeriod } from './useAccountingReport';
import styles from './PeriodStepper.module.css';

export interface PeriodStepperProps {
  mode: ReportMode;
  anchorMonth: string;
  period: ReportPeriod;
  onAnchorMonthChange: (month: string) => void;
}

const STEP_MONTHS: Record<ReportMode, number> = { month: 1, quarter: 3, year: 12 };

function shiftAnchorMonth(anchorMonth: string, mode: ReportMode, direction: 1 | -1): string {
  const [year, month] = anchorMonth.split('-').map(Number);
  const totalMonths = year * 12 + (month - 1) + direction * STEP_MONTHS[mode];
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = ((totalMonths % 12) + 12) % 12;
  return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;
}

/** Lună: MonthPicker existent. Trimestru/An: aceeași formă de pill, cu eticheta perioadei calculate în domeniu. */
export function PeriodStepper({ mode, anchorMonth, period, onAnchorMonthChange }: PeriodStepperProps) {
  if (mode === 'month') return <MonthPicker value={anchorMonth} onChange={onAnchorMonthChange} />;

  return (
    <div className={styles.root}>
      <IconButton
        icon="chevron-left"
        ariaLabel="Perioada anterioară"
        className={styles.arrow}
        onClick={() => onAnchorMonthChange(shiftAnchorMonth(anchorMonth, mode, -1))}
      />
      <span className={styles.label}>{period.label}</span>
      <IconButton
        icon="chevron-right"
        ariaLabel="Perioada următoare"
        className={styles.arrow}
        onClick={() => onAnchorMonthChange(shiftAnchorMonth(anchorMonth, mode, 1))}
      />
    </div>
  );
}
