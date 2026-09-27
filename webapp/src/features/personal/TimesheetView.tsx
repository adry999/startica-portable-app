import { Fragment, useEffect, useState } from 'react';
import { Button, Card, FilterPills, LoadingState, MonthStepper, type PillTone } from '@shared/ui';
import { today } from '#shared/domain/calendar-month.mjs';
import { usePersonal } from '@shared/personal/usePersonal';
import { nextTimesheetCode, summarizeTimesheetMonth, timesheetKey } from '@shared/personal/timesheet-rules';
import { useTimesheet } from './useTimesheet';
import { TimesheetPrintDialog } from './TimesheetPrintDialog';
import { TimesheetPrint } from './TimesheetPrint';
import type { TimesheetCode } from '@shared/personal/personal.types';
import styles from './TimesheetView.module.css';

export interface TimesheetViewProps {
  month: string;
}

const CELL_LABEL: Record<string, string> = { CO: 'CO', CM: 'CM', A: 'A' };

/** Pontaj (23b) — grilă lună × angajat, clic ciclează gol → CO → CM → A → gol. */
export function TimesheetView({ month: initialMonth }: TimesheetViewProps) {
  const [month, setMonth] = useState(initialMonth.slice(0, 7));
  const personal = usePersonal();
  const timesheet = useTimesheet(month);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [printOptions, setPrintOptions] = useState<{ scope: 'all' | 'department' | 'staff'; targetId?: string } | null>(
    null,
  );

  useEffect(() => {
    if (!printOptions) return;
    const timer = setTimeout(() => window.print(), 0);
    const onAfterPrint = () => setPrintOptions(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [printOptions]);

  function shiftMonth(delta: number) {
    const [year, monthNumber] = month.split('-').map(Number);
    const date = new Date(year, monthNumber - 1 + delta, 1);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }

  const activeStaff = personal.staff.filter(person => !person.archivedAt);
  const filteredStaff =
    departmentFilter === 'all'
      ? activeStaff
      : activeStaff.filter(person => personal.roleDepartmentId(person.roleId) === departmentFilter);

  const departmentsSorted = [...personal.departments].sort((a, b) => a.order - b.order);
  const departmentTones: PillTone[] = ['orange', 'mint', 'yellow', 'pink'];
  const departmentTone = new Map(departmentsSorted.map((department, index) => [department.id, departmentTones[index % departmentTones.length]]));

  const todayStr = today();
  const summaries = filteredStaff.map(person => ({
    staff: person,
    summary: summarizeTimesheetMonth({ staff: person, month, rows: timesheet.rows, todayStr, upTo: 'today' }),
  }));
  const dayCount = summaries[0]?.summary.cells.length ?? 0;
  const gridTemplateColumns = `190px repeat(${dayCount}, minmax(0, 1fr)) 44px 36px 36px`;

  function cellClick(staffId: string, date: string, currentCode: TimesheetCode | '' | undefined) {
    const next = nextTimesheetCode((currentCode as TimesheetCode) || null);
    timesheet.mark([{ staffId, date, code: next }]);
  }

  if (personal.status === 'loading' || timesheet.status === 'loading') return <LoadingState />;
  if (personal.status === 'failed') return <p className={styles.notice}>{personal.failureMessage}</p>;
  if (timesheet.status === 'failed') return <p className={styles.notice}>{timesheet.failureMessage}</p>;

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <MonthStepper value={month} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} />
        <Button variant="outline" onClick={() => setPrintOptions({ scope: 'all' })}>
          Tipărește
        </Button>
      </div>

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

          {summaries.map(({ staff, summary }) => (
            <Fragment key={staff.id}>
              <div className={styles.nameCell}>{staff.name}</div>
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
                    {cell.kind && CELL_LABEL[cell.kind] ? CELL_LABEL[cell.kind] : ''}
                  </div>
                );
              })}
              <div className={styles.totalCell}>{summary.worked}</div>
              <div className={styles.totalCell}>{summary.co}</div>
              <div className={styles.totalCell}>{summary.a}</div>
            </Fragment>
          ))}
        </div>
      </Card>

      <div className={styles.legend}>
        <span className={styles.legendItem} data-kind="worked">
          Lucrat
        </span>
        <span className={styles.legendItem} data-kind="CO">
          CO
        </span>
        <span className={styles.legendItem} data-kind="CM">
          CM
        </span>
        <span className={styles.legendItem} data-kind="A">
          A
        </span>
        <span className={styles.legendItem} data-kind="off">
          Zi liberă
        </span>
      </div>

      <TimesheetPrintDialog
        open={printOptions !== null}
        departments={departmentsSorted}
        staff={activeStaff}
        onCancel={() => setPrintOptions(null)}
        onConfirm={options => setPrintOptions(options)}
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
        />
      )}
    </div>
  );
}

