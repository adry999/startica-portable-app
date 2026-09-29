import { Fragment, useEffect, useState } from 'react';
import { Card, FilterPills, LoadingState, type PillTone } from '@shared/ui';
import { today } from '#shared/domain/calendar-month.mjs';
import { usePersonal } from '@shared/personal/usePersonal';
import { useKindergarten } from '@shared/api/useKindergarten';
import { nextTimesheetCode, summarizeTimesheetMonth, timesheetKey } from '@shared/personal/timesheet-rules';
import { useTimesheet } from './useTimesheet';
import { TimesheetPrintDialog, type TimesheetPrintOptions } from './TimesheetPrintDialog';
import { TimesheetPrint } from './TimesheetPrint';
import type { TimesheetCode } from '@shared/personal/personal.types';
import styles from './TimesheetView.module.css';

export interface TimesheetViewProps {
  month: string;
  /** „Tipărește” (23b) stă în antet, în PersonalPage — doar deschide dialogul; tipărirea în sine
   * pornește la confirmarea din TimesheetPrintDialog, nu la clicul din antet (M5). */
  printDialogOpen: boolean;
  onPrintDialogClose: () => void;
}

const CELL_LABEL: Record<string, string> = { CO: 'CO', CM: 'CM', A: 'A' };

/** Pontaj (23b) — grilă lună × angajat, clic ciclează gol → CO → CM → A → gol. */
export function TimesheetView({ month, printDialogOpen, onPrintDialogClose }: TimesheetViewProps) {
  const personal = usePersonal();
  const timesheet = useTimesheet(month);
  // Montat aici (nu în TimesheetPrint) ca cererea /api/kindergarten să pornească la intrarea pe
  // filă, nu la confirmarea dialogului — vezi gardă kindergarten.ready din efectul de tipărire (M4).
  const kindergarten = useKindergarten();
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [printOptions, setPrintOptions] = useState<TimesheetPrintOptions | null>(null);

  useEffect(() => {
    if (!printOptions || !kindergarten.ready) return;
    const timer = setTimeout(() => window.print(), 0);
    const onAfterPrint = () => setPrintOptions(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [printOptions, kindergarten.ready]);

  const activeStaff = personal.staff.filter(person => !person.archivedAt);
  const filteredStaff =
    departmentFilter === 'all'
      ? activeStaff
      : activeStaff.filter(person => personal.roleDepartmentId(person.roleId) === departmentFilter);

  const departmentsSorted = [...personal.departments].sort((a, b) => a.order - b.order);
  const departmentTones: PillTone[] = ['orange', 'mint', 'yellow', 'pink'];
  const departmentTone = new Map(
    departmentsSorted.map((department, index) => [department.id, departmentTones[index % departmentTones.length]]),
  );

  const todayStr = today();
  const summaries = filteredStaff.map(person => ({
    staff: person,
    summary: summarizeTimesheetMonth({ staff: person, month, rows: timesheet.rows, todayStr, upTo: 'today' }),
  }));
  const dayCount = summaries[0]?.summary.cells.length ?? 0;
  const gridTemplateColumns = `190px repeat(${dayCount}, minmax(0, 1fr)) 44px 36px 36px`;

  // Grupat pe departamente, ca 23a (24-personal.md #23b).
  const groupedByDepartment = departmentsSorted
    .map(department => ({
      department,
      rows: summaries
        .filter(({ staff }) => personal.roleDepartmentId(staff.roleId) === department.id)
        .sort((a, b) => a.staff.name.localeCompare(b.staff.name, 'ro')),
    }))
    .filter(group => group.rows.length > 0);

  function cellClick(staffId: string, date: string, currentCode: TimesheetCode | '' | undefined) {
    const next = nextTimesheetCode((currentCode as TimesheetCode) || null);
    timesheet.mark([{ staffId, date, code: next }]);
  }

  if (personal.status === 'loading' || timesheet.status === 'loading') return <LoadingState />;
  if (personal.status === 'failed') return <p className={styles.notice}>{personal.failureMessage}</p>;
  if (timesheet.status === 'failed') return <p className={styles.notice}>{timesheet.failureMessage}</p>;

  return (
    <div className={styles.root}>
      <FilterPills
        groups={[
          {
            label: 'Departament',
            value: departmentFilter,
            onChange: setDepartmentFilter,
            options: [
              { value: 'all', label: 'Toate', tone: 'neutral' },
              ...departmentsSorted.map(department => ({
                value: department.id,
                label: department.name,
                tone: departmentTone.get(department.id) ?? ('neutral' as PillTone),
              })),
            ],
          },
        ]}
      />

      <Card className={styles.tableCard}>
        <div className={styles.grid} style={{ gridTemplateColumns }}>
          <div className={styles.headCell}>Angajat</div>
          {summaries[0]?.summary.cells.map(cell => (
            <div key={cell.date} className={styles.headCell}>
              {Number(cell.date.slice(8, 10))}
            </div>
          ))}
          <div className={styles.headCell}>Lucrate</div>
          <div className={styles.headCell}>CO</div>
          <div className={styles.headCell}>A</div>

          {groupedByDepartment.map(({ department, rows }) => (
            <Fragment key={department.id}>
              <div className={styles.departmentHead} style={{ gridColumn: '1 / -1' }}>
                <span
                  className={styles.departmentSquare}
                  style={{ background: `var(--${departmentTone.get(department.id)}-soft, var(--neutral-soft))` }}
                  aria-hidden
                />
                <strong>{department.name}</strong>
                <span className={styles.departmentCount}>{rows.length}</span>
              </div>
              {rows.map(({ staff, summary }) => (
                <Fragment key={staff.id}>
                  <div className={styles.nameCell}>
                    <strong>{staff.name}</strong>
                    <small>{personal.roleName(staff.roleId)}</small>
                  </div>
                  {summary.cells.map(cell => {
                    const clickable = cell.kind !== 'off' && cell.kind !== 'none' && cell.kind !== 'future';
                    return (
                      <div
                        key={cell.date}
                        className={styles.cell}
                        data-kind={cell.kind || 'worked'}
                        onClick={
                          clickable
                            ? () =>
                                cellClick(
                                  staff.id,
                                  cell.date,
                                  timesheet.rows.get(timesheetKey(staff.id, cell.date))?.code,
                                )
                            : undefined
                        }
                        role={clickable ? 'button' : undefined}
                        tabIndex={clickable ? 0 : undefined}
                        aria-label={`${staff.name}: ${cell.date}`}
                      >
                        {cell.kind && CELL_LABEL[cell.kind] ? (
                          <span className={styles.pill} data-kind={cell.kind}>
                            {CELL_LABEL[cell.kind]}
                          </span>
                        ) : (
                          ''
                        )}
                      </div>
                    );
                  })}
                  <div className={`${styles.totalCell} ${styles.totalWorked}`}>{summary.worked}</div>
                  <div className={`${styles.totalCell} ${styles.totalCo}`}>{summary.co}</div>
                  <div className={`${styles.totalCell} ${styles.totalA}`}>{summary.a}</div>
                </Fragment>
              ))}
            </Fragment>
          ))}
        </div>
      </Card>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendSquare} data-kind="worked" />
          Lucrat
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendSquare} data-kind="CO">
            CO
          </span>
          Concediu de odihnă
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendSquare} data-kind="CM">
            CM
          </span>
          Concediu medical
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendSquare} data-kind="A">
            A
          </span>
          Absență
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendSquare} data-kind="off" />
          Zi liberă
        </span>
      </div>
      <p className={styles.footnote}>
        Clic pe o zi ciclează gol → CO → CM → A → gol. Zilele viitoare și cele libere nu se pot marca.
      </p>

      <TimesheetPrintDialog
        open={printDialogOpen}
        departments={departmentsSorted}
        staff={activeStaff}
        onCancel={onPrintDialogClose}
        onConfirm={options => {
          onPrintDialogClose();
          setPrintOptions(options);
        }}
      />

      {printOptions && (
        <TimesheetPrint
          month={month}
          staff={
            printOptions.scope === 'staff'
              ? activeStaff.filter(person => person.id === printOptions.targetId)
              : printOptions.scope === 'department'
                ? activeStaff.filter(person => personal.roleDepartmentId(person.roleId) === printOptions.targetId)
                : activeStaff
          }
          rows={timesheet.rows}
          roleName={personal.roleName}
          kindergarten={kindergarten.settings}
          display={printOptions.display}
        />
      )}
    </div>
  );
}
