import { useAppSession } from '@shared/api/session';
import { useAttendance } from '@shared/attendance';
import { useExchangeRates } from '@shared/api/useExchangeRates';
import { today as todayFn, shiftDays } from '@domain/calendar-month.mjs';
import { isWorkingDay } from '@domain/holidays-md.mjs';
// summarizeCashForMonth/sumUnallocatedAdvance nu sunt în #features/dashboard/index.web.mjs
// (doar view-creatoarele sunt publice azi) — import direct de domain, backendul nu se atinge
// pentru o simplă lipsă din API-ul public. Restul vine deja prin index.web.mjs, ca-n convenție.
import { summarizeCashForMonth, sumUnallocatedAdvance } from '#features/dashboard/domain/cash-summary.mjs';
import { toMdlToday } from '#features/billing/index.web.mjs';
import { buildBirthdayCalendar, listUpcomingBirthdays } from '#features/children/index.web.mjs';
import { isChildEnrolledOn, summarizeDay } from '#features/attendance/index.web.mjs';
import { missingChildFields } from '#shared/domain/missing-child-fields.mjs';
import { arrears, nextMonth } from '#shared/domain/tuition-obligation.mjs';
import { groupNameOf } from '#shared/domain/record-labels.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatDayMonthNumeric, formatMonthOnly } from '#shared/format/date-format.mjs';

/** „Telefon părinte, plan sau grupă" — listă în cuvinte, nu „A, B, C". */
function joinAsText(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} sau ${items[items.length - 1]}`;
}

function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLocaleLowerCase('ro-RO') + text.slice(1) : text;
}

export type AttentionTone = 'bani' | 'date' | 'sistem';

export interface AttentionItem {
  count: number | string;
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

// F24 (PROMPT-11 §12): azi intră în „prezență nemarcată” doar după ora de închidere a grădiniței —
// altfel dimineața arată mereu zgomot („N copii nemarcați pe azi”, ziua nu s-a terminat încă). Nu
// există încă o setare „ora de închidere” pe ecranul Grădiniței (vezi INTREBARI.md §12) — implicit
// fix, ca în prompt.
const CLOSING_HOUR = 18;

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
  /** Cel mai apropiat copil cu zi de naștere, oricât de departe — doar când `upcomingBirthdays`
   * e gol (F25, PROMPT-11 §13: „fără nimeni în 5 zile" arată totuși „Următoarea"). */
  nextBirthday: ReturnType<typeof listUpcomingBirthdays>[number] | undefined;
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
  const { rates } = useExchangeRates();
  const todayStr = todayFn();
  // F24 (PROMPT-11 §12): azi intră în calcul doar după ora de închidere — înainte de ea, ultima
  // zi lucrătoare se caută strict înainte de azi.
  const isPastClosing = new Date().getHours() >= CLOSING_HOUR;
  // 45c: trebuie apelat necondiționat (regula hook-urilor) — `null` cât timp sesiunea nu e gata
  // încă rezolvă singur în 'ready' fără nicio cerere (vezi useAttendance.ts).
  const attendanceDate = lastWorkingDayOnOrBefore(isPastClosing ? todayStr : shiftDays(todayStr, -1));
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
      nextBirthday: undefined,
    };
  }

  const records = state;
  const cash = summarizeCashForMonth(records, month);
  const advance = sumUnallocatedAdvance(records.payments, todayStr);
  const activeChildren = records.children.filter(child => !child.archived);

  // F23 (PROMPT-11 §11): intervalul pornește de la prima lună cu date (încasări SAU cheltuieli >
  // 0), nu mereu 12 luni fixe — lunile goale de dinainte nu se desenează.
  const fullHistory: RevenueBar[] = [];
  const fullExpenseHistory: RevenueBar[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(`${month}-15T12:00:00`);
    d.setMonth(d.getMonth() - i);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthCash = summarizeCashForMonth(records, m);
    fullHistory.push({ month: m, value: monthCash.income, byMethod: monthCash.byMethod });
    fullExpenseHistory.push({ month: m, value: monthCash.expense });
  }
  const firstDataIndex = fullHistory.findIndex((bar, index) => bar.value > 0 || fullExpenseHistory[index].value > 0);
  const revenueHistory = firstDataIndex === -1 ? [] : fullHistory.slice(firstDataIndex);
  const expenseHistory = firstDataIndex === -1 ? [] : fullExpenseHistory.slice(firstDataIndex);

  // 45c (PROMPT-8 §14) — „Necesită atenție”, 5 surse posibile, ordinea bani/date/prezență/sistem,
  // „apar doar elementele care au o acțiune” (deci fiecare intră în listă doar dacă count > 0 /
  // backup-ul chiar e vechi), max. 5 (exact câte surse există azi, dar `.slice` rămâne o gardă).

  // Bani — restanțe peste scadență (arrears multi-lună, nu doar luna afișată pe Dashboard — un
  // copil restant de 3 luni trebuie să arate cea mai veche lună, nu doar ultima).
  let overdueSumMdl = 0;
  let oldestOverdueMonth: string | null = null;
  const overdueChildIds = new Set<string>();
  for (const child of activeChildren) {
    for (const entry of arrears(child, records.payments, records.charges, nextMonth(month), todayStr)) {
      // arrears() împinge rândul doar când rest > 0 — null e teoretic exclus, dar tipul rămâne opțional.
      if (entry.rest === null) continue;
      const restMdl = toMdlToday(entry.rest, entry.currency, rates);
      if (restMdl !== null) overdueSumMdl += restMdl;
      overdueChildIds.add(child.id);
      if (!oldestOverdueMonth || entry.month < oldestOverdueMonth) oldestOverdueMonth = entry.month;
    }
  }
  const overdueItem: AttentionItem | null =
    overdueChildIds.size > 0
      ? {
          count: overdueChildIds.size,
          title: 'Restanțe peste scadență',
          detail: `${formatMoney(overdueSumMdl, 'MDL')} · cea mai veche din ${formatMonthOnly(oldestOverdueMonth)}`,
          action: 'Vezi situația',
          view: 'status',
          params: { segment: 'overdue' },
          tone: 'bani',
        }
      : null;

  // Date — fișe cu câmpuri obligatorii lipsă (§9.3): detaliul arată cele mai frecvente 2-3 câmpuri
  // lipsă, în cuvinte, nu doar un număr de fișe.
  const missingFieldCounts = new Map<string, number>();
  const missingFieldLabels = new Map<string, string>();
  let missingFieldsCount = 0;
  for (const child of activeChildren) {
    const fields = missingChildFields(child).filter(field => field.required);
    if (fields.length > 0) missingFieldsCount += 1;
    for (const field of fields) {
      missingFieldCounts.set(field.key, (missingFieldCounts.get(field.key) ?? 0) + 1);
      missingFieldLabels.set(field.key, field.label.replace(/ \d+$/, ''));
    }
  }
  const topMissingFields = [...missingFieldCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key], index) => (index === 0 ? missingFieldLabels.get(key)! : lowerFirst(missingFieldLabels.get(key)!)));
  const missingFieldsItem: AttentionItem | null =
    missingFieldsCount > 0
      ? {
          count: missingFieldsCount,
          title: 'Copii cu date obligatorii lipsă',
          detail: joinAsText(topMissingFields),
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
          title: 'Telefoane invalide',
          detail: 'Nu primesc SMS',
          action: 'Corectează',
          view: 'children',
          params: { filtru: 'telefon-invalid' },
          tone: 'date',
        }
      : null;

  // Prezență — ultima zi lucrătoare ÎNCHEIATĂ nemarcată, pe grupă, nu pe copii.
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
  const unmarkedByGroup = new Map<string, number>();
  for (const child of activeChildren) {
    if (!enrolledTodayIds.includes(child.id) || attendanceByChildId.has(child.id)) continue;
    const key = child.groupId ?? '';
    unmarkedByGroup.set(key, (unmarkedByGroup.get(key) ?? 0) + 1);
  }
  const unmarkedGroupKeys = [...unmarkedByGroup.keys()];
  const isYesterday = attendanceDate === shiftDays(todayStr, -1);
  const attendanceItem: AttentionItem | null =
    unmarkedCount > 0
      ? {
          count: unmarkedGroupKeys.length,
          title: isYesterday
            ? 'Prezența de ieri nemarcată'
            : `Prezența nemarcată din ${formatDayMonthNumeric(attendanceDate)}`,
          detail:
            unmarkedGroupKeys.length === 1
              ? `Grupa ${groupNameOf(unmarkedGroupKeys[0], records.groups) || 'Fără grupă'} · ${unmarkedCount} ${unmarkedCount === 1 ? 'copil' : 'copii'}`
              : `${unmarkedGroupKeys.length} grupe · ${unmarkedCount} copii`,
          action: 'Marchează',
          view: 'attendance',
          // Grupa intră în link doar când o singură grupă are goluri — altfel ziua deschisă arată toate grupele.
          params:
            unmarkedGroupKeys.length === 1 && unmarkedGroupKeys[0]
              ? { data: attendanceDate, grupa: unmarkedGroupKeys[0] }
              : { data: attendanceDate },
          tone: 'date',
        }
      : null;

  // Sistem — ultima copie externă de backup, mai veche de 7 zile (sau niciodată făcută).
  const typedHealth = health as BackupHealthShape | undefined;
  const lastExternal = typedHealth?.lastExternal;
  const backupAgeDays = lastExternal ? Math.floor((Date.now() - new Date(lastExternal).getTime()) / 86400000) : null;
  const backupStale = backupAgeDays === null || backupAgeDays > BACKUP_STALE_AFTER_DAYS;
  const backupItem: AttentionItem | null = backupStale
    ? {
        count: '!',
        title: backupAgeDays === null ? 'Niciun backup extern încă' : `Backup-ul extern are ${backupAgeDays} zile`,
        detail: lastExternal ? `Ultima copie pe stick: ${formatDayMonthNumeric(lastExternal)}` : '',
        action: 'Fă backup',
        view: 'settings',
        tone: 'sistem',
      }
    : null;

  const attentionItems = [overdueItem, missingFieldsItem, phoneInvalidItem, attendanceItem, backupItem]
    .filter((item): item is AttentionItem => item !== null)
    .slice(0, 5);

  const upcomingBirthdays = listUpcomingBirthdays(records.children, 5, todayStr);

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
    upcomingBirthdays,
    birthdayWeeks: buildBirthdayCalendar(records.children, todayStr),
    nextBirthday:
      upcomingBirthdays.length === 0 ? listUpcomingBirthdays(records.children, 366, todayStr)[0] : undefined,
  };
}
