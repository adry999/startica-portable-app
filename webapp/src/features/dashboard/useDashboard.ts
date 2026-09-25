import { useAppSession } from '@shared/api/session';
import { today as todayFn } from '@domain/calendar-month.mjs';
// summarizeCashForMonth/sumUnallocatedAdvance nu sunt în #features/dashboard/index.web.mjs
// (doar view-creatoarele sunt publice azi) — import direct de domain, backendul nu se atinge
// pentru o simplă lipsă din API-ul public. Restul vine deja prin index.web.mjs, ca-n convenție.
import { summarizeCashForMonth, sumUnallocatedAdvance } from '#features/dashboard/domain/cash-summary.mjs';
import { evaluateChildrenForMonth } from '#features/billing/index.web.mjs';
import { buildReviewCenter } from '#features/review-center/index.web.mjs';
import { countVisitsForDays } from '#features/visits/index.web.mjs';
import { buildBirthdayCalendar, listUpcomingBirthdays } from '#features/children/index.web.mjs';
import { hasMissingFee } from '#features/fee-setup/index.web.mjs';

export type AttentionTone = 'urgent' | 'review' | 'assign' | 'visits';

export interface AttentionItem {
  count: number;
  icon: string;
  title: string;
  detail: string;
  action: string;
  view: string;
  tone: AttentionTone;
  /** „Taxe și grupe" rămâne vizibil chiar la 0 de notificat, dacă mai sunt fișe fără taxă. */
  forceShow: boolean;
}

export interface RevenueBar {
  month: string;
  value: number;
}

export type DashboardStatus = 'loading' | 'ready' | 'failed';

export interface DashboardData {
  status: DashboardStatus;
  failureMessage: string;
  income: number;
  expense: number;
  net: number;
  byMethod: Record<string, number>;
  advance: number;
  revenueHistory: RevenueBar[];
  expenseHistory: RevenueBar[];
  attentionItems: AttentionItem[];
  allClear: boolean;
  hasAnyRecords: boolean;
  upcomingBirthdays: ReturnType<typeof listUpcomingBirthdays>;
  birthdayWeeks: ReturnType<typeof buildBirthdayCalendar>;
  reviewCount: number;
}

/**
 * Toată logica e domeniu pur, reutilizat neschimbat din backend (cash-summary,
 * billing, review-center, visits, children — vezi comentariile de import).
 * evaluateChildrenForMonth + buildReviewCenter le vor folosi și „De notificat"/
 * „De verificat" (subagenți, pasul 5) — quando ajung acolo, se extrag de aici
 * într-un hook comun în loc să se recalculeze.
 */
export function useDashboard(month: string): DashboardData {
  const session = useAppSession();
  const { state, ready, loading, saveError } = session.state;
  const todayStr = todayFn();

  if (!ready) {
    return {
      status: loading || !saveError ? 'loading' : 'failed',
      failureMessage: saveError,
      income: 0,
      expense: 0,
      net: 0,
      byMethod: {},
      advance: 0,
      revenueHistory: [],
      expenseHistory: [],
      attentionItems: [],
      allClear: true,
      hasAnyRecords: false,
      upcomingBirthdays: [],
      birthdayWeeks: [],
      reviewCount: 0,
    };
  }

  const records = state;
  const cash = summarizeCashForMonth(records, month);
  const advance = sumUnallocatedAdvance(records.payments, todayStr);
  const evaluations = evaluateChildrenForMonth(records, month, todayStr);
  const activeEvaluations = evaluations.filter(e => !e.child.archived);
  const review = buildReviewCenter(records);
  const missingFeeCount = activeEvaluations.filter(({ child }) => hasMissingFee(child)).length;
  const toNotify = activeEvaluations.filter(r => r.obligation.notify).length;
  const unassigned = records.payments.filter(
    (p: { archived: boolean; childId: string | null }) => !p.archived && !p.childId,
  ).length;
  const visitsSummary = countVisitsForDays(records.visits, todayStr, 1);

  const revenueHistory: RevenueBar[] = [];
  const expenseHistory: RevenueBar[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(`${month}-15T12:00:00`);
    d.setMonth(d.getMonth() - i);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthCash = summarizeCashForMonth(records, m);
    revenueHistory.push({ month: m, value: monthCash.income });
    expenseHistory.push({ month: m, value: monthCash.expense });
  }

  const attentionItems: AttentionItem[] = [
    missingFeeCount > 0
      ? {
          count: toNotify,
          icon: '!',
          title: 'Achitări de urmărit',
          detail: `${toNotify} de notificat · ${missingFeeCount} fără taxă (nu se pot calcula)`,
          action: toNotify === 0 ? 'Completează' : 'Vezi lista',
          view: toNotify === 0 ? 'fees' : 'notify',
          tone: 'urgent',
          forceShow: true,
        }
      : {
          count: toNotify,
          icon: '!',
          title: 'Achitări de urmărit',
          detail: toNotify === 1 ? '1 copil trebuie notificat.' : `${toNotify} copii trebuie notificați.`,
          action: 'Vezi lista',
          view: 'notify',
          tone: 'urgent',
          forceShow: false,
        },
    {
      count: review.items.length,
      icon: '✓',
      title: 'Înregistrări de verificat',
      detail:
        review.items.length === 1
          ? '1 fișă sau achitare necesită verificare.'
          : `${review.items.length} fișe sau achitări necesită verificare.`,
      action: 'Verifică',
      view: 'review',
      tone: 'review',
      forceShow: false,
    },
    {
      count: unassigned,
      icon: '↗',
      title: 'Achitări neasociate',
      detail:
        unassigned === 1
          ? '1 achitare nu este legată de un copil.'
          : `${unassigned} achitări nu sunt legate de un copil.`,
      action: 'Asociază',
      view: 'assign',
      tone: 'assign',
      forceShow: false,
    },
    {
      count: visitsSummary.today + visitsSummary.tomorrow,
      icon: '◷',
      title: 'Vizite programate',
      detail:
        visitsSummary.today > 0 || visitsSummary.tomorrow > 0
          ? `${visitsSummary.today} azi · ${visitsSummary.tomorrow} mâine`
          : 'Nicio vizită azi sau mâine.',
      action: 'Vezi calendarul',
      view: 'visits',
      tone: 'visits',
      forceShow: false,
    },
  ];

  return {
    status: 'ready',
    failureMessage: '',
    income: cash.income,
    expense: cash.expense,
    net: cash.net,
    byMethod: cash.byMethod,
    advance,
    revenueHistory,
    expenseHistory,
    attentionItems,
    allClear: attentionItems.every(item => item.count === 0 && !item.forceShow),
    hasAnyRecords: records.children.length > 0 || records.payments.length > 0,
    upcomingBirthdays: listUpcomingBirthdays(records.children, 5, todayStr),
    birthdayWeeks: buildBirthdayCalendar(records.children, todayStr),
    reviewCount: review.items.length,
  };
}
