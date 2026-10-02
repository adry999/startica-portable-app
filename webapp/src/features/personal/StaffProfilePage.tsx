import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  ConfirmDeleteDialog,
  LoadingState,
  ProfileLayout,
  ProfileNotFound,
  ProfileSection,
  StatCard,
  useToast,
  useTopbarTitle,
} from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { today } from '#shared/domain/calendar-month.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { usePersonal } from '@shared/personal/usePersonal';
import { bothBranchesLabel, birthdayTag } from '@shared/personal/staff-labels';
import { summarizeTimesheetMonth } from '@shared/personal/timesheet-rules';
import { leaveDaysRemaining } from '@shared/personal/leave-days';
import { useTimesheet } from './useTimesheet';
import { useLeaves } from '@shared/personal/useLeaves';
import { StaffFormDrawer } from './StaffFormDrawer';
import type { Group, GroupTeamMember } from '@contracts/record-types.mjs';
import styles from './StaffProfilePage.module.css';
import { toUserError } from '@shared/api/to-user-error';

const TIMESHEET_CELL_LABEL: Record<string, string> = {
  CO: 'C',
  CM: 'B',
  A: 'A',
  I: 'Î',
  FP: 'F',
};

/** Fișa angajatului (23j) — pagină proprie, ca fișa copilului. */
export function StaffProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const session = useAppSession();
  const personal = usePersonal();

  const month = today().slice(0, 7);
  const year = today().slice(0, 4);
  const timesheet = useTimesheet(month);
  const leavesData = useLeaves(year);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  useTopbarTitle(id ? { title: 'Fișa angajatului', eyebrow: 'Personal' } : null);

  if (personal.status === 'loading') return <LoadingState />;
  if (personal.status === 'failed')
    return <p className={styles.notice}>{personal.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const staff = id ? personal.staffById.get(id) : undefined;
  if (!staff) {
    return <ProfileNotFound back={{ label: 'Personal', onClick: () => navigate('/personal') }} />;
  }

  const staffId = staff.id;
  const branchIds = session.state.branches.map(branch => branch.id);
  const groups = (session.state.state?.groups ?? []) as Group[];
  const staffGroups: { group: Group; entry: GroupTeamMember }[] = [];
  for (const group of groups) {
    const entry = group.team?.find(member => member.staffId === staffId);
    if (entry) staffGroups.push({ group, entry });
  }

  const timesheetSummary = summarizeTimesheetMonth({
    staff,
    month,
    rows: timesheet.rows,
    todayStr: today(),
    upTo: 'today',
  });
  const yearLeaves = leavesData.leaves.filter(leave => leave.staffId === staff.id);
  const remaining = leaveDaysRemaining({ leaves: yearLeaves, annualLeaveDays: personal.settings.annualLeaveDays });

  async function archive() {
    try {
      await personal.archiveStaff(staffId, today());
      toast.show({ message: 'Angajatul a fost marcat „nu mai lucrează aici”.' });
      setArchiveConfirmOpen(false);
      navigate('/personal');
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  const branchTag = bothBranchesLabel(staff, branchIds);
  const birthday = birthdayTag(staff.birth);

  return (
    <>
      <ProfileLayout
        back={{ label: 'Personal', onClick: () => navigate('/personal') }}
        header={{
          name: staff.name,
          tone: 'orange',
          meta: personal.roleName(staff.roleId),
          badges: [
            { label: staff.archivedAt ? 'Nu mai lucrează' : 'Activ', tone: 'mint' },
            ...(branchTag || birthday
              ? [
                  {
                    label: [branchTag, birthday && `ziua de naștere ${birthday}`].filter(Boolean).join(' · '),
                    tone: 'orange' as const,
                  },
                ]
              : []),
          ],
          actions: (
            <Button variant="white" onClick={() => setEditOpen(true)}>
              Editează fișa
            </Button>
          ),
        }}
        left={
          <>
            <ProfileSection title="Date personale">
              <p>Telefon: {staff.phone || '—'}</p>
              <p>IDNP: {staff.idnp || '—'}</p>
              <p>Adresă: {staff.address || '—'}</p>
              <p>Angajat din: {formatDate(staff.since)}</p>
            </ProfileSection>

            <ProfileSection title="Grupe">
              {staffGroups.length === 0 && <p className={styles.notice}>Fără grupă asignată.</p>}
              {staffGroups.map(({ group, entry }) => (
                <p key={group.id}>
                  {group.name} ·{' '}
                  {entry.role === 'principal' ? 'principal' : entry.role === 'asistent' ? 'asistent' : 'înlocuitor'}
                </p>
              ))}
            </ProfileSection>

            <ProfileSection title="Note" tone="yellow">
              {staff.notes.length === 0 && <p>Fără note.</p>}
              {staff.notes.map(note => (
                <p key={note.at}>
                  {formatDate(note.at)} — {note.text}
                </p>
              ))}
            </ProfileSection>

            <Button variant="outline" onClick={() => setArchiveConfirmOpen(true)}>
              Nu mai lucrează aici
            </Button>
          </>
        }
        stats={[
          <StatCard
            key="worked"
            label="Zile lucrate · boală"
            tone="mint"
            value={`${timesheetSummary.worked} · ${timesheetSummary.cm}`}
          />,
          <StatCard
            key="leave"
            label="Concediu rămas"
            tone="yellow"
            value={`${remaining.remaining} din ${personal.settings.annualLeaveDays}`}
            sub={remaining.planned > 0 ? `${remaining.planned} planificate` : undefined}
          />,
          <StatCard
            key="salary"
            label="Salariu"
            value="•••••"
            link={{ label: 'Vezi cu PIN →', onClick: () => navigate('/personal?tab=salarii') }}
          />,
        ]}
        right={
          <>
            <ProfileSection title="Pontajul lunii">
              <div className={styles.dotsRow}>
                {timesheetSummary.cells.map(cell => (
                  <span key={cell.date} className={styles.dot} title={cell.date} data-kind={cell.kind || 'worked'}>
                    {cell.kind && cell.kind !== 'off' && cell.kind !== 'none' && cell.kind !== 'future'
                      ? (TIMESHEET_CELL_LABEL[cell.kind] ?? '')
                      : ''}
                  </span>
                ))}
              </div>
            </ProfileSection>

            <ProfileSection title="Concediile anului">
              {yearLeaves.length === 0 && <p className={styles.notice}>Fără concedii în {year}.</p>}
              {yearLeaves.map(leave => (
                <p key={leave.id}>
                  <Badge tone={leave.type === 'CO' ? 'yellow' : leave.type === 'CM' ? 'pink' : 'neutral'}>
                    {leave.type}
                  </Badge>{' '}
                  {formatDate(leave.from)} – {formatDate(leave.to)}
                  {leave.planned && ' · planificat'}
                </p>
              ))}
            </ProfileSection>
          </>
        }
      />

      {/* C2: fără key, drawer-ul rămâne montat cu target=null de la prima randare —
          defaultValues(null) nu se mai recalculează la „Editează fișa”, iar formularul
          apare gol (data angajării devine azi la salvare). */}
      <StaffFormDrawer
        key={editOpen ? staff.id : 'closed'}
        target={editOpen ? staff : null}
        onClose={() => setEditOpen(false)}
      />

      <ConfirmDeleteDialog
        open={archiveConfirmOpen}
        title="Nu mai lucrează aici"
        description={`${staff.name} nu va mai apărea în echipa activă, pontaj sau concedii. Fișa rămâne în istoric.`}
        confirmWord="ARHIVEAZĂ"
        onConfirm={() => void archive()}
        onCancel={() => setArchiveConfirmOpen(false)}
      />
    </>
  );
}
