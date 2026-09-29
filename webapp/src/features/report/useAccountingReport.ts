import { useAppSession } from '@shared/api/session';
import { reportPeriodBounds, buildAccountingReport } from '#features/report/index.web.mjs';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';

export type ReportMode = 'month' | 'quarter' | 'year';

export interface ReportPeriod {
  from: string;
  to: string;
  label: string;
}

export interface ReportMethodRow {
  method: string;
  amount: number;
  count: number;
  percent: number;
}

export interface ReportCategoryRow {
  category: string;
  amount: number;
  count: number;
  percent: number;
}

export interface ReportEurRow {
  id: string;
  date: string;
  childLabel: string;
  amount: number;
  fxRate: number | null;
  fxRateSource: 'bnm' | 'manual' | null;
  amountEur: number | null;
}

export interface ReportDayRow {
  date: string;
  cash: number;
  cardTransfer: number;
  expense: number;
  balance: number;
}

export interface ReportPaymentRow {
  id: string;
  date: string;
  childId: string;
  childLabel: string;
  payerLabel: string;
  unassigned: boolean;
  methods: string[];
  /** Numele serviciului (B3, ALINIERE-DESIGN.md §B3) — „Grădiniță" implicit, „Bazin" sau un serviciu liber. */
  service: string;
  amount: number;
  fxRate: number | null;
  fxRateSource: 'bnm' | 'manual' | null;
  amountEur: number | null;
  months: string[];
  archived: boolean;
}

export interface ReportExpenseRow {
  id: string;
  date: string;
  category: string;
  categoryBucket: string;
  description: string;
  method: 'cash' | 'card' | 'transfer' | null;
  amount: number;
  archived: boolean;
}

export interface AccountingReport {
  period: ReportPeriod;
  income: number;
  incomeCount: number;
  expense: number;
  expenseCount: number;
  balance: number;
  unassignedCount: number;
  byMethod: ReportMethodRow[];
  byCategory: ReportCategoryRow[];
  eurRows: ReportEurRow[];
  eurTotalLei: number;
  eurTotalEur: number;
  days: ReportDayRow[];
  paymentRows: ReportPaymentRow[];
  expenseRows: ReportExpenseRow[];
}

/**
 * Același calcul ca ecranul, dar peste înregistrările unei alte filiale (citite read-only,
 * vezi `@shared/api/branches#fetchBranchRecords`) — folosit de exportul „Ambele” (20).
 */
export function buildForRecords(
  records: RecordsSnapshot,
  period: ReportPeriod,
  options?: { includeArchived?: boolean },
): AccountingReport {
  return buildAccountingReport(records, period, options) as AccountingReport;
}

export type ReportStatus = 'loading' | 'ready' | 'failed';

export interface AccountingReportData {
  status: ReportStatus;
  failureMessage: string;
  records: RecordsSnapshot;
  period: ReportPeriod;
  report: AccountingReport | null;
  /** Aceeași funcție ca ecranul, cu opțiunea de export „Include achitările arhivate” — vezi `buildAccountingReport`. */
  buildForPeriod: (period: ReportPeriod, options?: { includeArchived?: boolean }) => AccountingReport;
}

/**
 * Ancorat pe `anchorMonth` (YYYY-MM), ca ecranul și exportul să folosească
 * mereu aceleași granițe — vezi `reportPeriodBounds`. Doar citire, nu creează date.
 */
export function useAccountingReport(anchorMonth: string, mode: ReportMode): AccountingReportData {
  const session = useAppSession();
  const { state, ready, loading, saveError } = session.state;
  const records = state as RecordsSnapshot;
  const period = reportPeriodBounds(mode, anchorMonth) as ReportPeriod;

  function buildForPeriod(targetPeriod: ReportPeriod, options?: { includeArchived?: boolean }): AccountingReport {
    return buildAccountingReport(records, targetPeriod, options) as AccountingReport;
  }

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      records,
      period,
      report: null,
      buildForPeriod,
    };
  }

  return {
    status: 'ready',
    failureMessage: '',
    records,
    period,
    report: buildForPeriod(period),
    buildForPeriod,
  };
}
