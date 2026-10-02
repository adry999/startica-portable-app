import { useAppSession } from '@shared/api/session';
import { useAttendance } from '@shared/attendance';
import { today as todayFn, shiftDays } from '@domain/calendar-month.mjs';
import { isWorkingDay } from '@domain/holidays-md.mjs';
// summarizeCashForMonth/sumUnallocatedAdvance nu sunt în #features/dashboard/index.web.mjs
// (doar view-creatoarele sunt publice azi) — import direct de domain, backendul nu se atinge
// pentru o simplă lipsă din API-ul public. Restul vine deja prin index.web.mjs, ca-n convenție.
import { summarizeCashForMonth, sumUnallocatedAdvance } from '#features/dashboard/domain/cash-summary.mjs';
import { evaluateChildrenForMonth, summarizeMonthStatus } from '#features/billing/index.web.mjs';
import { buildBirthdayCalendar, listUpcomingBirthdays } from '#features/children/index.web.mjs';
import { isChildEnrolledOn, summarizeDay } from '#features/attendance/index.web.mjs';
import { missingChildFields } from '#shared/domain/missing-child-fields.mjs';

export type AttentionTone = 'bani' | 'date' | 'prezenta' | 'sistem';

export interface AttentionItem {
  count: number;
  title: string;
  detail: string;
  action: string;
  view: string;
  /** Parametri opționali de trecut lui onNavigate (ex. filtrul de pe Copii, ziua pe Prezența). */
  params?: Record<string, string>;
  tone: AttentionTone;
}

// O zi în ms, ca la useBackup.ts — dar pragul de aici e 7 zile (45c, PROMPT-8 §14),
// nu 24h (pragul din Setări · Backup, un alt ecran, altă întrebare: „e la zi azi?").
const BACKUP_STALE_AFTER_DAYS = 7;

export interface RevenueBar {
  month: string;
  value: number;
  byMethod?: Record<string, number>;
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
}

/** Forma minimă citită din `session.state.health` (BackupHealthView, @features/backup/useBackup) —
 * tip local, nu import din alt feature (architecture.test.ts: „niciun fișier dintr-un feature nu
 * importă direct dintr-un alt feature”). */
interface BackupHealthShape {
  lastExternal?: string;
}

/** Cea mai recentă zi lucrătoare de pe sau dinaintea `date` (45c: „prezență nemarcată”, zile trecute). */
function lastWorkingDayOnOrBefore(date: string): string {
  let candidate = date;
  while (!isWorkingDay(candidate)) candidate = shiftDays(candidate, -1);
  return candidate;
}

/**
 * Toată logica e domeniu pur, reutilizat neschimbat din backend (cash-summary,
 * billing, children, attendance — vezi comentariile de import).
 */
export function useDashboard(month: string): DashboardData {
  const session = useAppSession();
  const { state, ready, loading, saveError, health } = session.state;
  const todayStr = todayFn();
  // 45c: trebuie apelat necondiționat (regula hook-urilor) — `null` cât timp sesiunea nu e gata
  // încă rezolvă singur în 'ready' fără nicio cerere (vezi useAttendance.ts).
  const attendanceDate = lastWorkingDayOnOrBefore(todayStr);
  const attendance = useAttendance(ready ? { date: attendanceDate } : null);

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
    };
  }

  const records = state;
  const cash = summarizeCashForMonth(records, month);
  const advance = sumUnallocatedAdvance(records.payments, todayStr);
  const evaluations = evaluateChildrenForMonth(records, month, todayStr);
  const activeEvaluations = evaluations.filter(e => !e.child.archived);
  const activeChildren = records.children.filter(child => !child.archived);

  const revenueHistory: RevenueBar[] = [];
  const expenseHistory: RevenueBar[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(`${month}-15T12:00:00`);
    d.setMonth(d.getMonth() - i);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthCash = summarizeCashForMonth(records, m);
    revenueHistory.push({ month: m, value: monthCash.income, byMethod: monthCash.byMethod });
    expenseHistory.push({ month: m, value: monthCash.expense });
  }

  // 45c (PROMPT-8 §14) — „Necesită atenție”, 5 surse posibile, ordinea bani/date/prezență/sistem,
  // „apar doar elementele care au o acțiune” (deci fiecare intră în listă doar dacă count > 0 /
  // backup-ul chiar e vechi), max. 5 (exact câte surse există azi, dar `.slice` rămâne o gardă).

  // Bani — restanțe (Situația).
  const overdueChildren = summarizeMonthStatus(activeEvaluations).overdueChildren;
  const overdueItem: AttentionItem | null =
    overdueChildren > 0
      ? {
          count: overdueChildren,
          title: 'Restanțe',
          detail: overdueChildren === 1 ? '1 copil are plata restantă.' : `${overdueChildren} copii au plata restantă.`,
          action: 'Vezi lista',
          view: 'status',
          params: { segment: 'overdue' },
          tone: 'bani',
        }
      : null;

  // Date — fișe cu câmpuri obligatorii lipsă (§9.3) și telefon invalid (§10).
  const missingFieldsCount = activeChildren.filter(child => missingChildFields(child).length > 0).length;
  const missingFieldsItem: AttentionItem | null =
    missingFieldsCount > 0
      ? {
          count: missingFieldsCount,
          title: 'Date incomplete',
          detail:
            missingFieldsCount === 1
              ? '1 fișă are câmpuri obligatorii lipsă.'
              : `${missingFieldsCount} fișe au câmpuri obligatorii lipsă.`,
          action: 'Completează',
          view: 'children',
          params: { filtru: 'incomplete' },
          tone: 'date',
        }
      : null;

  const phoneInvalidCount = activeChildren.filter(child => child.phoneInvalid || child.phone2Invalid).length;
  const phoneInvalidItem: AttentionItem | null =
    phoneInvalidCount > 0
      ? {
          count: phoneInvalidCount,
          title: 'Telefon invalid',
          detail: phoneInvalidCount === 1 ? '1 telefon nu e valid.' : `${phoneInvalidCount} telefoane nu sunt valide.`,
          action: 'Verifică',
          view: 'children',
          params: { filtru: 'telefon-invalid' },
          tone: 'date',
        }
      : null;

  // Prezență — zile lucrătoare trecute nemarcate (cea mai recentă, inclusiv azi dacă e lucrătoare).
  const enrolledTodayIds = activeChildren
    .filter(child => isChildEnrolledOn(child, attendanceDate))
    .map(child => child.id);
  const attendanceByChildId = new Map(
    [...attendance.entries.values()]
      .filter(entry => entry.date === attendanceDate)
      .map(entry => [entry.childId, entry]),
  );
  const unmarkedCount =
    attendance.status === 'ready' ? summarizeDay(enrolledTodayIds, attendanceByChildId).unmarked : 0;
  const unmarkedGroupIds = new Set(
    activeChildren
      .filter(child => enrolledTodayIds.includes(child.id) && !attendanceByChildId.has(child.id))
      .map(child => child.groupId)
      .filter((groupId): groupId is string => Boolean(groupId)),
  );
  const attendanceItem: AttentionItem | null =
    unmarkedCount > 0
      ? {
          count: unmarkedCount,
          title: 'Prezență nemarcată',
          detail:
            unmarkedCount === 1
              ? `1 copil nemarcat pe ${attendanceDate === todayStr ? 'azi' : attendanceDate}.`
              : `${unmarkedCount} copii nemarcați pe ${attendanceDate === todayStr ? 'azi' : attendanceDate}.`,
          action: 'Marchează',
          view: 'attendance',
          // Grupa intră în link doar când o singură grupă are goluri — altfel ziua deschisă arată toate grupele.
          params:
            unmarkedGroupIds.size === 1
              ? { data: attendanceDate, grupa: [...unmarkedGroupIds][0] }
              : { data: attendanceDate },
          tone: 'prezenta',
        }
      : null;

  // Sistem — ultima copie externă de backup, mai veche de 7 zile (sau niciodată făcută).
  const typedHealth = health as BackupHealthShape | undefined;
  const lastExternal = typedHealth?.lastExternal;
  const backupAgeDays = lastExternal ? Math.floor((Date.now() - new Date(lastExternal).getTime()) / 86400000) : null;
  const backupStale = backupAgeDays === null || backupAgeDays > BACKUP_STALE_AFTER_DAYS;
  const backupItem: AttentionItem | null = backupStale
    ? {
        count: backupAgeDays ?? 0,
        title: 'Backup extern vechi',
        detail:
          backupAgeDays === null
            ? 'Nicio copie externă de backup încă.'
            : `Ultima copie externă e veche de ${backupAgeDays} zile.`,
        action: 'Verifică backup',
        view: 'settings',
        tone: 'sistem',
      }
    : null;

  const attentionItems = [overdueItem, missingFieldsItem, phoneInvalidItem, attendanceItem, backupItem]
    .filter((item): item is AttentionItem => item !== null)
    .slice(0, 5);

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
    allClear: attentionItems.length === 0,
    hasAnyRecords: records.children.length > 0 || records.payments.length > 0,
    upcomingBirthdays: listUpcomingBirthdays(records.children, 5, todayStr),
    birthdayWeeks: buildBirthdayCalendar(records.children, todayStr),
  };
}
