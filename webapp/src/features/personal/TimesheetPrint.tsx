import type { KindergartenSettings } from '@shared/api/useKindergarten';
import { PrintTable, type PrintTableColumn } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { formatMonthLabel } from '#shared/format/date-format.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
import { summarizeTimesheetMonth } from '@shared/personal/timesheet-rules';
import type { Staff, TimesheetRow } from '@shared/personal/personal.types';
import styles from './TimesheetPrint.module.css';

export interface TimesheetPrintProps {
  month: string;
  staff: Staff[];
  rows: ReadonlyMap<string, TimesheetRow>;
  roleName: (roleId: string) => string;
  /** Vine de la TimesheetView, care ține hook-ul montat de la intrarea pe filă (M4) — TimesheetPrint
   * nu mai cere singur /api/kindergarten, ca să nu tipărească cu antetul generic înainte de răspuns. */
  kindergarten: KindergartenSettings | null;
  /** „Cum arăt zilele” din dialogul de tipărire (23k): ore lucrate „8” sau prezență „P”. */
  display: 'hours' | 'present';
}

const ROWS_PER_PAGE = 14;

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages;
}

/** Pontaj tipărit (23k) — A4 orizontal, alb-negru; peste 14 rânduri, antetul se repetă pe pagina următoare. */
export function TimesheetPrint({ month, staff, rows, roleName, kindergarten, display }: TimesheetPrintProps) {
  const workedLabel = display === 'present' ? 'P' : '8';
  const session = useAppSession();
  const todayStr = today();

  const staffRows = staff
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    .map(person => ({
      staff: person,
      summary: summarizeTimesheetMonth({ staff: person, month, rows, todayStr, upTo: 'month' }),
    }));

  const dayNumbers = staffRows[0]?.summary.cells.map(cell => Number(cell.date.slice(8, 10))) ?? [];
  const pages = chunk(staffRows, ROWS_PER_PAGE);
  const workingDaysCount = staffRows[0]?.summary.workingDays ?? 0;

  type StaffRow = (typeof staffRows)[number];

  function dayCellText(cell: { kind: string }): string {
    return cell.kind === '' ? workedLabel : cell.kind === 'off' || cell.kind === 'none' ? '' : cell.kind;
  }

  return (
    <div className={styles.printSheet}>
      <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>

      {pages.map((pageRows, pageIndex) => {
        const columns: PrintTableColumn<StaffRow>[] = [
          { key: 'nr', header: 'Nr.', render: row => pageIndex * ROWS_PER_PAGE + pageRows.indexOf(row) + 1 },
          { key: 'nume', header: 'Numele, funcția', render: row => `${row.staff.name}, ${roleName(row.staff.roleId)}` },
          ...dayNumbers.map((day, dayIndex) => ({
            key: `day-${dayIndex}`,
            header: day,
            className: styles.printDayCol,
            render: (row: StaffRow) => dayCellText(row.summary.cells[dayIndex]),
          })),
          { key: 'zile', header: 'Zile', render: row => row.summary.worked },
          { key: 'ore', header: 'Ore', render: row => row.summary.hours },
          { key: 'co', header: 'CO', render: row => row.summary.co },
          { key: 'cm', header: 'CM', render: row => row.summary.cm },
          { key: 'a', header: 'A', render: row => row.summary.a },
        ];

        return (
          <div key={pageIndex} className={styles.printPage}>
            <div className={styles.printHeader}>
              <div>
                <p className={styles.printTitle}>Tabel de pontaj · {formatMonthLabel(month)}</p>
                <p className={styles.printSubtitle}>
                  {workingDaysCount} zile lucrătoare · {workingDaysCount * 8} ore
                </p>
              </div>
              <div className={styles.printKindergarten}>
                <span>{kindergarten?.displayName || kindergarten?.name || 'Startica'}</span>
                {session.state.branch && <span>Subdiviziunea: Filiala {session.state.branch.name}</span>}
              </div>
            </div>

            <PrintTable className={styles.printTable} columns={columns} rows={pageRows} rowKey={row => row.staff.id} />

            {pageIndex === pages.length - 1 && (
              <>
                <p className={styles.printLegend}>
                  Legendă: {workedLabel} = lucrat, CO = concediu de odihnă, CM = concediu medical, A = absență, Î =
                  învoire, FP = fără plată.
                </p>
                <div className={styles.printSignatures}>
                  <span>Director: __________________</span>
                  <span>Administrator: __________________</span>
                  <span>Contabil: __________________</span>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
