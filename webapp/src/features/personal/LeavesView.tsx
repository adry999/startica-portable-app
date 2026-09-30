import { useMemo, useState, type CSSProperties } from 'react';
import { Badge, Button, Card, IconButton, LoadingState, groupTone } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { today } from '#shared/domain/calendar-month.mjs';
import { usePersonal } from '@shared/personal/usePersonal';
import { leaveDaysRemaining, leaveYearBar, formatLeaveRange } from '@shared/personal/leave-days';
import { useLeaves } from '@shared/personal/useLeaves';
import { LeaveFormDrawer } from './LeaveFormDrawer';
import type { Leave } from '@shared/personal/personal.types';
import type { Group } from '@contracts/record-types.mjs';
import styles from './LeavesView.module.css';

const MONTH_LABELS = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];

/** Grupa din echipa căreia îi aparține angajatul (doar educatorii/asistenții sunt în `group.team`). */
function groupForStaff(staffId: string, groups: Group[]): Group | null {
  return groups.find(group => group.team?.some(member => member.staffId === staffId)) ?? null;
}

/** Culoarea barei: planificat > CM > implicit (CO/FP) — planificatul are prioritate chiar pe CM. */
function leaveBarStyle(leave: Leave): CSSProperties {
  if (leave.planned) return { background: 'var(--leave-planned)', border: '1.5px dashed var(--leave-planned-border)' };
  if (leave.type === 'CM') return { background: 'var(--raspberry)' };
  return { background: 'var(--yellow-bar)' };
}

/** Concedii (23f) — o pistă pe an per angajat, bare pe zile (nu pe luni), cu avertizare de suprapunere. */
export function LeavesView() {
  const personal = usePersonal();
  const session = useAppSession();
  const groups = (session.state.state?.groups ?? []) as Group[];
  const year = today().slice(0, 4);
  const currentMonthIndex = Number(today().slice(5, 7)) - 1;
  const leavesData = useLeaves(year);
  const [drawerTarget, setDrawerTarget] = useState<Leave | 'new' | null>(null);

  const groupById = useMemo(() => new Map(groups.map(group => [group.id, group])), [groups]);

  if (personal.status === 'loading' || leavesData.status === 'loading') return <LoadingState />;
  if (personal.status === 'failed') return <p className={styles.notice}>{personal.failureMessage}</p>;
  if (leavesData.status === 'failed') return <p className={styles.notice}>{leavesData.failureMessage}</p>;

  const activeStaff = personal.staff.filter(person => !person.archivedAt);

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Concedii {year}</h2>
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={styles.legendBar} data-kind="co" /> Concediu
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendBar} data-kind="cm" /> Boală
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendBar} data-kind="planned" /> Planificat
            </span>
          </div>
        </div>
        <Button onClick={() => setDrawerTarget('new')}>+ Concediu</Button>
      </div>

      <div className={styles.monthHeader}>
        <span className={styles.staffCellHead}>Angajat</span>
        <span className={styles.monthTrack}>
          {MONTH_LABELS.map((label, index) => (
            <span key={label} className={index === currentMonthIndex ? styles.currentMonth : undefined}>
              {label}
            </span>
          ))}
        </span>
        <span className={styles.remainingHead}>Rămas</span>
      </div>

      {activeStaff.map(person => {
        const staffLeaves = leavesData.leaves.filter(leave => leave.staffId === person.id);
        const remaining = leaveDaysRemaining({
          leaves: staffLeaves,
          annualLeaveDays: personal.settings.annualLeaveDays,
        });
        const group = groupForStaff(person.id, groups);

        return (
          <div key={person.id} className={styles.row}>
            <span className={styles.staffCell}>
              <span className={styles.name}>{person.name}</span>
              {group && <Badge tone={groupTone(group.id, groups)}>{group.name}</Badge>}
            </span>
            <span className={styles.track}>
              <span className={styles.trackBands}>
                {MONTH_LABELS.map(label => (
                  <span key={label} />
                ))}
              </span>
              <span className={styles.trackBars}>
                {staffLeaves.map(leave => {
                  const bar = leaveYearBar(leave, year);
                  const label = `${person.name}: ${formatLeaveRange(leave.from, leave.to)}`;
                  return (
                    <IconButton
                      key={leave.id}
                      icon={null}
                      ariaLabel={label}
                      title={label}
                      className={styles.leaveBar}
                      style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%`, ...leaveBarStyle(leave) }}
                      onClick={() => setDrawerTarget(leave)}
                    />
                  );
                })}
              </span>
            </span>
            <span className={styles.remaining} data-negative={remaining.remaining < 0 || undefined}>
              {remaining.remaining} zile
            </span>
          </div>
        );
      })}

      {leavesData.warnings.length > 0 && (
        <div className={styles.warningBanner} role="alert">
          {leavesData.warnings.map((warning, index) => {
            const names = warning.staffIds.map(id => personal.staffById.get(id)?.name ?? id).join(' și ');
            const groupName = groupById.get(warning.groupId)?.name ?? '—';
            return (
              <p key={index}>
                <strong>Atenție:</strong> {names} ({groupName}) au concediu suprapus{' '}
                {formatLeaveRange(warning.from, warning.to)}. Grupa rămâne fără educator; alege un înlocuitor.
              </p>
            );
          })}
        </div>
      )}

      {/* C2: 'closed' distinct de 'new'/id-ul concediului — altfel a doua deschidere reia instanța
          (și valorile) celei anterioare, în loc să pornească de la formularul potrivit. */}
      <LeaveFormDrawer
        key={drawerTarget === null ? 'closed' : drawerTarget === 'new' ? 'new' : drawerTarget.id}
        target={drawerTarget}
        staff={activeStaff}
        onClose={() => setDrawerTarget(null)}
        onSubmit={leavesData.saveLeave}
        onDelete={leavesData.removeLeave}
      />
    </Card>
  );
}
