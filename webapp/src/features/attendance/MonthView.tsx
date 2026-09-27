import { Fragment, useState } from 'react';
import { Card, FilterPills, LoadingState, groupTone, type PillTone } from '@shared/ui';
import { AttendanceDot } from '@shared/attendance';
import { formatMonthName } from '#shared/format/date-format.mjs';
import { ExcuseReasonPopover } from './ExcuseReasonPopover';
import type { AttendanceMonthData } from './useAttendanceMonth';
import styles from './MonthView.module.css';

export interface MonthViewProps {
  month: string;
  data: AttendanceMonthData;
}

/** Ecranul Luna (18b): grilă copil × zi pentru o singură grupă, cu tipărire A4 și export .xlsx. */
export function MonthView({ month, data }: MonthViewProps) {
  const [excuseTarget, setExcuseTarget] = useState<{ childId: string; date: string } | null>(null);

  if (data.status === 'loading') return <LoadingState />;
  if (data.status === 'failed')
    return <p className={styles.notice}>{data.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  function handleCycle(childId: string, date: string) {
    const next = data.cycle(childId, date);
    setExcuseTarget(next === 'excused' ? { childId, date } : null);
  }

  const groupOptions: { value: string; label: string; tone: PillTone }[] = [
    ...data.groups.map(group => ({ value: group.id, label: group.name, tone: groupTone(group.id, data.groups) })),
    ...(data.hasUnassignedChildren ? [{ value: 'none', label: 'Fără grupă', tone: 'neutral' as PillTone }] : []),
  ];

  const gridTemplateColumns = `200px repeat(${data.dates.length}, minmax(0, 1fr)) 70px`;

  // Legenda din dreapta barei de filtre (18b): zile lucrătoare din lună + prezența medie a grupei.
  const workingDaysCount = data.offDays.filter(off => !off).length;
  const totalPresent = data.rows.reduce((sum, row) => sum + row.presentDays, 0);
  const totalPossible = data.rows.reduce((sum, row) => sum + row.workingDays, 0);
  const averageAttendanceLabel = totalPossible > 0 ? `${Math.round((totalPresent / totalPossible) * 100)}%` : '—';

  return (
    <div className={styles.root}>
      <div className={styles.filterBar}>
        <FilterPills
          groups={[{ label: 'Grupa', value: data.groupId, onChange: data.setGroupId, options: groupOptions }]}
          trailing={
            <span className={styles.legendStat}>
              {workingDaysCount} zile lucrătoare · prezență medie <b>{averageAttendanceLabel}</b>
            </span>
          }
        />
      </div>

      <h2 className={styles.printTitle}>
        Prezența · {data.groupName} · {formatMonthName(month)}
      </h2>

      {data.rows.length === 0 ? (
        <p className={styles.notice}>Niciun copil în această grupă.</p>
      ) : (
        <Card className={styles.tableCard}>
          <div className={styles.grid} style={{ gridTemplateColumns }}>
            <div className={styles.headCell}>Copil</div>
            {data.dayNumbers.map((day, index) => (
              <div
                key={data.dates[index]}
                className={`${styles.headCell} ${styles.dayCell} ${data.offDays[index] ? styles.offHead : ''} ${index === data.todayIndex ? styles.todayHead : ''}`}
              >
                {day}
              </div>
            ))}
            <div className={`${styles.headCell} ${styles.totalsHead}`}>Zile</div>

            {data.rows.map(row => (
              <Fragment key={row.id}>
                <div key={`${row.id}-name`} className={styles.nameCell}>
                  {row.name}
                </div>
                {row.cells.map((cell, index) => (
                  <div
                    key={`${row.id}-${cell.date}`}
                    className={`${styles.cell} ${data.offDays[index] ? styles.offCell : ''}`}
                  >
                    {cell.kind === 'present' ||
                    cell.kind === 'absent' ||
                    cell.kind === 'excused' ||
                    cell.kind === 'unmarked' ? (
                      <button
                        type="button"
                        className={styles.cellButton}
                        aria-label={`${row.name}: ${cell.date}`}
                        onClick={() => handleCycle(row.id, cell.date)}
                      >
                        <AttendanceDot kind={cell.kind} />
                      </button>
                    ) : cell.kind === 'future' ? (
                      <AttendanceDot kind="future" />
                    ) : null}
                    {excuseTarget?.childId === row.id && excuseTarget.date === cell.date && (
                      <ExcuseReasonPopover
                        childName={row.name}
                        reason={cell.reason}
                        onSave={reason => {
                          data.setReason(row.id, cell.date, reason);
                          setExcuseTarget(null);
                        }}
                        onClose={() => setExcuseTarget(null)}
                      />
                    )}
                  </div>
                ))}
                <div key={`${row.id}-days`} className={styles.daysCell}>
                  {row.presentDays}/{row.workingDays}
                </div>
              </Fragment>
            ))}

            <div className={`${styles.footCell} ${styles.footLabel}`}>Prezenți pe zi</div>
            {data.presentPerDay.map((count, index) => (
              <div key={`present-${data.dates[index]}`} className={styles.footCell}>
                {count ?? ''}
              </div>
            ))}
            <div className={styles.footCell} />
          </div>
        </Card>
      )}
    </div>
  );
}
