import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppSession } from '@shared/api/session';
import { useKindergarten, type KindergartenSettings } from '@shared/api/useKindergarten';
import { usePersonal } from '@shared/personal/usePersonal';
import type { Staff } from '@shared/personal/personal.types';
import { sortByGroupOrder } from '@shared/format/group-order';
import { shiftDays } from '@domain/calendar-month.mjs';
import { formatDateTime, ageInYears } from '#shared/format/date-format.mjs';
import { isChildEnrolledOn } from '#features/attendance/index.web.mjs';
import type { Child, Group, RecordsSnapshot } from '@contracts/record-types.mjs';
import styles from './WeeklySheet.module.css';

const ROWS_PER_SHEET = 16;
const WEEKDAY_NAMES = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri'];
const MONTHS_SHORT_RO = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
const MONTHS_LONG_RO = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
];

/** Lunea săptămânii care conține `dateIso` (26-foaie-saptamana.md §1). */
export function mondayOf(dateIso: string): string {
  const day = new Date(dateIso + 'T12:00:00').getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return shiftDays(dateIso, diff);
}

/** Cele 5 zile lucrătoare (luni-vineri) ale săptămânii care începe la `weekStart`. */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 5 }, (_, index) => shiftDays(weekStart, index));
}

/** Câte foi A4 sunt necesare pentru `count` copii — 16 rânduri pe foaie, minim 1 foaie. */
export function sheetsForGroupCount(count: number): number {
  return Math.max(1, Math.ceil(count / ROWS_PER_SHEET));
}

/** Un copil e activ în săptămână dacă e înscris în cel puțin una din cele 5 zile lucrătoare. */
export function isChildActiveInWeek(child: Child, weekStart: string): boolean {
  return weekDates(weekStart).some(date => isChildEnrolledOn(child, date));
}

function shortDayDate(dateIso: string): string {
  return `${dateIso.slice(8, 10)}.${dateIso.slice(5, 7)}`;
}

/** „28 sep – 2 oct 2026” — eticheta stepper-ului din fereastra 18c. */
export function formatWeekRangeShort(weekStart: string): string {
  const [from, to] = [weekDates(weekStart)[0], weekDates(weekStart)[4]];
  const fromMonth = MONTHS_SHORT_RO[Number(from.slice(5, 7)) - 1];
  const toMonth = MONTHS_SHORT_RO[Number(to.slice(5, 7)) - 1];
  return `${Number(from.slice(8, 10))} ${fromMonth} – ${Number(to.slice(8, 10))} ${toMonth} ${to.slice(0, 4)}`;
}

/** „28 septembrie – 2 octombrie 2026” — antetul foii tipărite (18d). */
export function formatWeekRangeLong(weekStart: string): string {
  const [from, to] = [weekDates(weekStart)[0], weekDates(weekStart)[4]];
  const fromMonth = MONTHS_LONG_RO[Number(from.slice(5, 7)) - 1];
  const toMonth = MONTHS_LONG_RO[Number(to.slice(5, 7)) - 1];
  return `${Number(from.slice(8, 10))} ${fromMonth} – ${Number(to.slice(8, 10))} ${toMonth} ${to.slice(0, 4)}`;
}

/** Vârsta pe scurt („5a 2l”, „8l”) — doar pentru rândul copilului din foaie, nu formatul lung din fișă. */
export function compactAge(birthDate: string | undefined): string {
  if (!birthDate) return '';
  const birth = new Date(birthDate + 'T12:00:00');
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months--;
  if (months < 0) return '';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${months}l`;
  return rest === 0 ? `${years}a` : `${years}a ${rest}l`;
}

/** Eticheta din coloana „Alergii · detalii” (26-foaie-saptamana.md §2) — cuvinte-cheie exacte din spec. */
export function healthBadge(healthNotes: string | undefined): 'ALERGIE' | 'MEDICAL' | null {
  if (!healthNotes) return null;
  const lower = healthNotes.toLocaleLowerCase('ro-RO');
  if (lower.includes('alergi')) return 'ALERGIE';
  if (['astm', 'epilep', 'diabet', 'inhalator'].some(keyword => lower.includes(keyword))) return 'MEDICAL';
  return null;
}

function resolveEducators(
  group: Group,
  staffById: ReadonlyMap<string, Staff>,
): {
  principal: string;
  assistant: string | null;
} {
  const team = group.team ?? [];
  if (team.length > 0) {
    const principalMember = team.find(member => member.role === 'principal');
    const assistantMember = team.find(member => member.role === 'asistent');
    return {
      principal: principalMember ? (staffById.get(principalMember.staffId)?.name ?? '—') : '—',
      assistant: assistantMember ? (staffById.get(assistantMember.staffId)?.name ?? '—') : '—',
    };
  }
  // Fără echipă (Personal 24 neconfigurat) — fallback legacy, fără rândul „Asistent” (§2).
  return { principal: group.educator || '—', assistant: null };
}

function ageRangeOf(children: Child[]): string {
  const ages = children.map(child => ageInYears(child.birthDate)).filter((age): age is number => age !== null);
  if (ages.length === 0) return '';
  const min = Math.min(...ages);
  const max = Math.max(...ages);
  if (min === max) return `${min} ${min === 1 ? 'an' : 'ani'}`;
  return `${min}–${max} ani`;
}

export interface WeeklySheetChildRow {
  id: string;
  name: string;
  ageLabel: string;
  detailText: string;
  badge: 'ALERGIE' | 'MEDICAL' | null;
}

export interface WeeklySheetPageData {
  groupId: string;
  groupName: string;
  pageIndex: number;
  pageCount: number;
  isLastPage: boolean;
  children: WeeklySheetChildRow[];
  emptyRowCount: number;
  totalChildren: number;
  educatorPrincipal: string;
  educatorAssistant: string | null;
  ageRangeLabel: string;
}

/** Foile unei grupe — copiii activi din săptămână, paginați la 16 rânduri (26-foaie-saptamana.md §2/§5). */
export function buildWeeklySheetPages(
  group: Group,
  activeChildren: Child[],
  staffById: ReadonlyMap<string, Staff>,
): WeeklySheetPageData[] {
  const rows: WeeklySheetChildRow[] = activeChildren.map(child => ({
    id: child.id,
    name: child.name,
    ageLabel: compactAge(child.birthDate),
    detailText: (child.healthNotes ?? '').split('\n')[0] ?? '',
    badge: healthBadge(child.healthNotes),
  }));
  const pageCount = sheetsForGroupCount(activeChildren.length);
  const { principal, assistant } = resolveEducators(group, staffById);
  const ageRangeLabel = ageRangeOf(activeChildren);

  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const pageChildren = rows.slice(pageIndex * ROWS_PER_SHEET, pageIndex * ROWS_PER_SHEET + ROWS_PER_SHEET);
    return {
      groupId: group.id,
      groupName: group.name,
      pageIndex,
      pageCount,
      isLastPage: pageIndex === pageCount - 1,
      children: pageChildren,
      emptyRowCount: ROWS_PER_SHEET - pageChildren.length,
      totalChildren: activeChildren.length,
      educatorPrincipal: principal,
      educatorAssistant: assistant,
      ageRangeLabel,
    };
  });
}

/** Mesajul din fereastra 18c, sub pastilele de grupă — se schimbă după grupa din previzualizare. */
export function weeklySheetMessage(groupName: string, childCount: number, pageCount: number): string {
  if (childCount === 0) return `${groupName} nu are copii: doar rânduri libere.`;
  const emptyRows = pageCount * ROWS_PER_SHEET - childCount;
  const sheetsLabel = pageCount === 1 ? '1 foaie' : `${pageCount} foi`;
  return `${groupName}: ${childCount} copii + ${emptyRows} rânduri libere · ${sheetsLabel}`;
}

export interface WeeklySheetOptions {
  showDetails: boolean;
  showNotes: boolean;
}

export interface WeeklySheetProps {
  page: WeeklySheetPageData;
  weekStart: string;
  branchName: string;
  kindergarten: KindergartenSettings | null;
  options: WeeklySheetOptions;
}

/** O foaie A4 orizontală (18d) — una per grupă, sau una per 16 copii dacă grupa e mai mare. */
export function WeeklySheet({ page, weekStart, branchName, kindergarten, options }: WeeklySheetProps) {
  const dates = weekDates(weekStart);
  const emptyRows = Array.from({ length: page.emptyRowCount });

  const metaParts = [`Educator principal: ${page.educatorPrincipal}`];
  if (page.educatorAssistant !== null) metaParts.push(`Asistent: ${page.educatorAssistant}`);
  metaParts.push(`${page.totalChildren} ${page.totalChildren === 1 ? 'copil' : 'copii'}`);
  if (page.ageRangeLabel) metaParts.push(page.ageRangeLabel);

  return (
    <div className={styles.sheet}>
      <div className={styles.header}>
        {kindergarten?.logoDataUrl && <img src={kindergarten.logoDataUrl} alt="" className={styles.logo} />}
        <div className={styles.headTitleBlock}>
          <p className={styles.headTitle}>
            Prezența · Grupa {page.groupName} · {formatWeekRangeLong(weekStart)}
          </p>
          <p className={styles.headMeta}>{metaParts.join(' · ')}</p>
        </div>
        <div className={styles.headRight}>
          <strong className={styles.branchName}>{branchName}</strong>
          <span className={styles.legend}>Scrie: ✓ prezent · A absent · M motivat</span>
        </div>
      </div>

      <div
        className={styles.tableHead}
        style={{
          gridTemplateColumns: options.showDetails
            ? '22px 1.3fr 1.7fr repeat(5, 84px)'
            : '22px 1.3fr repeat(5, minmax(84px, 1fr))',
        }}
      >
        <span></span>
        <span>Copil</span>
        {options.showDetails && <span>Alergii · detalii</span>}
        {dates.map((date, index) => (
          <span key={date}>
            {WEEKDAY_NAMES[index]} / {shortDayDate(date)}
          </span>
        ))}
      </div>

      <div className={styles.table}>
        {page.children.map((child, index) => (
          <div
            key={child.id}
            className={`${styles.row} ${index % 2 === 1 ? styles.rowAlt : ''} ${options.showNotes ? '' : styles.rowTall}`}
            style={{
              gridTemplateColumns: options.showDetails
                ? '22px 1.3fr 1.7fr repeat(5, 84px)'
                : '22px 1.3fr repeat(5, minmax(84px, 1fr))',
            }}
          >
            <span className={styles.rowNumber}>{page.pageIndex * ROWS_PER_SHEET + index + 1}</span>
            <span className={styles.childCell}>
              <span className={styles.childName}>{child.name}</span>
              {child.ageLabel && <span className={styles.childAge}>{child.ageLabel}</span>}
            </span>
            {options.showDetails && (
              <span className={styles.detailCell}>
                {child.badge && <span className={styles.badge}>{child.badge}</span>}
                {child.detailText ? (
                  <span className={child.badge ? styles.detailTextStrong : styles.detailText}>{child.detailText}</span>
                ) : (
                  !child.badge && <span className={styles.detailText}>—</span>
                )}
              </span>
            )}
            {dates.map(date => (
              <span key={date} className={styles.dayCell}></span>
            ))}
          </div>
        ))}
        {emptyRows.map((_, index) => (
          <div
            key={`empty-${index}`}
            className={`${styles.row} ${styles.rowEmpty} ${(page.children.length + index) % 2 === 1 ? styles.rowAlt : ''} ${options.showNotes ? '' : styles.rowTall}`}
            style={{
              gridTemplateColumns: options.showDetails
                ? '22px 1.3fr 1.7fr repeat(5, 84px)'
                : '22px 1.3fr repeat(5, minmax(84px, 1fr))',
            }}
          >
            <span className={styles.rowNumber}>
              {page.pageIndex * ROWS_PER_SHEET + page.children.length + index + 1}
            </span>
            <span className={styles.emptyText}>Nume, prenume (nu e în aplicație)</span>
            {options.showDetails && <span className={styles.emptyText}>Alergii / detalii</span>}
            {dates.map(date => (
              <span key={date} className={styles.dayCell}></span>
            ))}
          </div>
        ))}
      </div>

      {options.showNotes && page.isLastPage && (
        <div className={styles.notes}>
          <p className={styles.notesTitle}>
            Notițe educator · ce s-a întâmplat, cine a plecat mai devreme, cine a preluat copilul
          </p>
          <div className={styles.notesGrid}>
            {dates.map((date, index) => (
              <div key={date} className={styles.notesColumn}>
                <span className={styles.notesColumnHead}>
                  {WEEKDAY_NAMES[index]} {shortDayDate(date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <span>Detaliile vin din fișa copilului. Foaia rămâne în grupă.</span>
        <span className={styles.signature}>Semnătura educatorului ____</span>
        <span>Introdus în aplicație ☐</span>
        <span>tipărit {formatDateTime(new Date().toISOString())}</span>
      </div>
    </div>
  );
}

/** Ruta de tipărire (§1): `/prezenta/foi?week=&groups=&info=&notes=` — doar foile, apoi window.print(). */
export function WeeklySheetPrintPage() {
  const [searchParams] = useSearchParams();
  const session = useAppSession();
  const personal = usePersonal();
  const kindergarten = useKindergarten();
  const { state, ready } = session.state;

  const weekParam = searchParams.get('week') ?? '';
  const weekStart = weekParam || mondayOf(new Date().toISOString().slice(0, 10));
  const groupIds = (searchParams.get('groups') ?? '').split(',').filter(Boolean);
  const options: WeeklySheetOptions = {
    showDetails: searchParams.get('info') !== '0',
    showNotes: searchParams.get('notes') !== '0',
  };

  const branchName =
    session.state.branch?.name || kindergarten.settings?.displayName || kindergarten.settings?.name || '';

  const pages = useMemo(() => {
    if (!ready) return [];
    const records = state as RecordsSnapshot;
    const groups = sortByGroupOrder(records.groups).filter(group => groupIds.includes(group.id));
    return groups.flatMap(group => {
      const activeChildren = records.children
        .filter(child => child.groupId === group.id)
        .filter(child => isChildActiveInWeek(child, weekStart))
        .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
      return buildWeeklySheetPages(group, activeChildren, personal.staffById);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [ready, state, weekStart, groupIds.join(','), personal.staffById]);

  const printedRef = useRef(false);
  useEffect(() => {
    if (pages.length > 0 && !printedRef.current) {
      printedRef.current = true;
      window.print();
    }
  }, [pages.length]);

  if (!ready || personal.status !== 'ready') return null;

  return (
    <div className={styles.printRoot}>
      <style>{'@page { size: A4 landscape; margin: 0; }'}</style>
      {pages.map(page => (
        <div key={`${page.groupId}-${page.pageIndex}`} className={styles.printPage}>
          <WeeklySheet
            page={page}
            weekStart={weekStart}
            branchName={branchName}
            kindergarten={kindergarten.settings}
            options={options}
          />
        </div>
      ))}
    </div>
  );
}
