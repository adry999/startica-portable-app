import { useKindergarten } from '@shared/api/useKindergarten';
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
}

const ROWS_PER_PAGE = 14;

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages;
}

/** Pontaj tipărit (23k) — A4 orizontal, alb-negru; peste 14 rânduri, antetul se repetă pe pagina următoare. */
export function TimesheetPrint({ month, staff, rows, roleName }: TimesheetPrintProps) {
  const kindergarten = useKindergarten();
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

  return (
    <div className={styles.printSheet}>
      <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>

      {pages.map((pageRows, pageIndex) => (
        <div key={pageIndex} className={styles.printPage}>
          <div className={styles.printHeader}>
            <div>
              <p className={styles.printTitle}>Tabel de pontaj · {formatMonthLabel(month)}</p>
              <p className={styles.printSubtitle}>
                {workingDaysCount} zile lucrătoare · {workingDaysCount * 8} ore
              </p>
            </div>
            <div className={styles.printKindergarten}>
              <span>{kindergarten.settings?.displayName || kindergarten.settings?.name || 'Startica'}</span>
              {session.state.branch && <span>Subdiviziunea: Filiala {session.state.branch.name}</span>}
            </div>
          </div>

          <table className={styles.printTable}>
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Numele, funcția</th>
                {dayNumbers.map(day => (
                  <th key={day} className={styles.printDayCol}>
                    {day}
                  </th>
                ))}
                <th>Zile</th>
                <th>Ore</th>
                <th>CO</th>
                <th>CM</th>
                <th>A</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(({ staff: person, summary }, index) => (
                <tr key={person.id}>
                  <td>{pageIndex * ROWS_PER_PAGE + index + 1}</td>
                  <td>
                    {person.name}, {roleName(person.roleId)}
                  </td>
                  {summary.cells.map(cell => (
                    <td key={cell.date} className={styles.printDayCol}>
                      {cell.kind === '' ? '8' : cell.kind === 'off' || cell.kind === 'none' ? '' : cell.kind}
                    </td>
                  ))}
                  <td>{summary.worked}</td>
                  <td>{summary.hours}</td>
                  <td>{summary.co}</td>
                  <td>{summary.cm}</td>
                  <td>{summary.a}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {pageIndex === pages.length - 1 && (
            <>
              <p className={styles.printLegend}>
                Legendă: 8 = lucrat, CO = concediu de odihnă, CM = concediu medical, A = absență, Î = învoire,
                FP = fără plată.
              </p>
              <div className={styles.printSignatures}>
                <span>Director: __________________</span>
                <span>Administrator: __________________</span>
                <span>Contabil: __________________</span>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
