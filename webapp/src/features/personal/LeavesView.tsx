import { useState } from 'react';
import { Badge, Button, Card, LoadingState } from '@shared/ui';
import { today } from '#shared/domain/calendar-month.mjs';
import { usePersonal } from '@shared/personal/usePersonal';
import { leaveDaysRemaining } from '@shared/personal/leave-days';
import { useLeaves } from '@shared/personal/useLeaves';
import { LeaveFormDrawer } from './LeaveFormDrawer';
import type { Leave } from '@shared/personal/personal.types';
import styles from './LeavesView.module.css';

const MONTH_LABELS = ['I', 'F', 'M', 'A', 'M', 'I', 'I', 'A', 'S', 'O', 'N', 'D'];

function monthsTouched(leave: Pick<Leave, 'from' | 'to'>): number[] {
  const months = new Set<number>();
  const fromMonth = Number(leave.from.slice(5, 7));
  const toMonth = Number(leave.to.slice(5, 7));
  for (let month = fromMonth; month <= toMonth; month += 1) months.add(month);
  return [...months];
}

/** Concedii (23f) — o linie pe an per angajat, cu avertizare de suprapunere în aceeași grupă. */
export function LeavesView() {
  const personal = usePersonal();
  const year = today().slice(0, 4);
  const leavesData = useLeaves(year);
  const [drawerTarget, setDrawerTarget] = useState<'new' | null>(null);

  if (personal.status === 'loading' || leavesData.status === 'loading') return <LoadingState />;
  if (personal.status === 'failed') return <p className={styles.notice}>{personal.failureMessage}</p>;
  if (leavesData.status === 'failed') return <p className={styles.notice}>{leavesData.failureMessage}</p>;

  const activeStaff = personal.staff.filter(person => !person.archivedAt);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Button onClick={() => setDrawerTarget('new')}>+ Concediu</Button>
      </div>

      {leavesData.warnings.length > 0 && (
        <div className={styles.warningBanner} role="alert">
          {leavesData.warnings.map((warning, index) => {
            const names = warning.staffIds.map(id => personal.staffById.get(id)?.name ?? id).join(' și ');
            return (
              <p key={index}>
                {names} au concedii care se suprapun în aceeași grupă ({warning.from} – {warning.to}).
              </p>
            );
          })}
        </div>
      )}

      <Card className={styles.tableCard}>
        <div className={styles.headRow}>
          <span>Angajat</span>
          <span className={styles.trackHead}>
            {MONTH_LABELS.map((label, index) => (
              <span key={index}>{label}</span>
            ))}
          </span>
          <span>Rămas</span>
        </div>
        {activeStaff.map(person => {
          const staffLeaves = leavesData.leaves.filter(leave => leave.staffId === person.id);
          const remaining = leaveDaysRemaining({
            leaves: staffLeaves,
            annualLeaveDays: personal.settings.annualLeaveDays,
          });
          const touchedByMonth = new Map<number, Leave>();
          for (const leave of staffLeaves) for (const month of monthsTouched(leave)) touchedByMonth.set(month, leave);

          return (
            <div key={person.id} className={styles.row}>
              <span className={styles.name}>{person.name}</span>
              <span className={styles.track}>
                {MONTH_LABELS.map((_, index) => {
                  const month = index + 1;
                  const leave = touchedByMonth.get(month);
                  return (
                    <span
                      key={month}
                      className={styles.trackCell}
                      data-type={leave?.type}
                      data-planned={leave?.planned || undefined}
                    />
                  );
                })}
              </span>
              <span className={styles.remaining}>
                <Badge tone={remaining.remaining < 0 ? 'pink' : 'mint'}>
                  {remaining.remaining} din {personal.settings.annualLeaveDays}
                </Badge>
              </span>
            </div>
          );
        })}
      </Card>

      {/* C2: 'closed' distinct de 'new' — altfel a doua „+ Concediu” reia instanța (și
          valorile) primei, în loc să pornească de la un formular gol. */}
      <LeaveFormDrawer
        key={drawerTarget === null ? 'closed' : 'new'}
        open={drawerTarget !== null}
        staff={activeStaff}
        onClose={() => setDrawerTarget(null)}
        onSubmit={leavesData.saveLeave}
      />
    </div>
  );
}
