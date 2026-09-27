import { useAppSession } from '@shared/api/session';
import { AttendanceDot, useAttendance } from '@shared/attendance';
import { Card } from '@shared/ui';
import { today } from '@domain/calendar-month.mjs';
import { formatDate, formatMonthName } from '#shared/format/date-format.mjs';
import { attendanceKey, summarizeMonth } from '#features/attendance/index.web.mjs';
import type { RecordsSnapshot } from '@contracts/record-types.mjs';
import styles from './ChildrenPage.module.css';

export interface ChildAttendanceSectionProps {
  childId: string;
  month: string;
}

/** Secțiunea „Prezența” din fișa copilului (spec 19): doar afișare, nicio marcare aici. */
export function ChildAttendanceSection({ childId, month }: ChildAttendanceSectionProps) {
  const session = useAppSession();
  const records = session.state.state as RecordsSnapshot;
  const child = records.children.find(candidate => candidate.id === childId);
  const attendance = useAttendance({ month, childId });

  if (!child) return null;

  const summary = summarizeMonth({ children: [child], month, entries: attendance.entries, todayStr: today() });
  const row = summary.rows[0];
  // Zilele libere (weekend/sărbătoare) și cele fără înscriere nu apar pe linia de puncte.
  const dotCells = row ? row.cells.filter(cell => cell.kind !== 'off' && cell.kind !== 'none') : [];
  const excusedAbsences = dotCells
    .filter(cell => cell.kind === 'excused')
    .map(cell => ({
      date: cell.date,
      reason: attendance.entries.get(attendanceKey(childId, cell.date))?.reason ?? '',
    }));

  return (
    <Card className={styles.profileSection}>
      <p className={styles.sectionTitle}>Prezența</p>
      <p className={styles.sectionMeta}>
        {formatMonthName(month)} · {row?.presentDays ?? 0} din {row?.workingDays ?? 0} zile
      </p>
      <div className={styles.attendanceDotRow}>
        {dotCells.map(cell => (
          <AttendanceDot key={cell.date} kind={cell.kind} size="sm" title={`${formatDate(cell.date)}`} />
        ))}
      </div>
      {excusedAbsences.length === 0 ? (
        <p className={styles.notice}>Nicio absență motivată luna aceasta.</p>
      ) : (
        <ul className={styles.attendanceExcusedList}>
          {excusedAbsences.map(absence => (
            <li key={absence.date}>
              {formatDate(absence.date)} — {absence.reason || 'fără motiv'}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
