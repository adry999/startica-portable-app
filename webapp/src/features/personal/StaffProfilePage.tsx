import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, ConfirmDeleteDialog, LoadingState, useToast, useTopbarTitle } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { today } from '#shared/domain/calendar-month.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { usePersonal } from '@shared/personal/usePersonal';
import { bothBranchesLabel, birthdayTag, initials } from '@shared/personal/staff-labels';
import { summarizeTimesheetMonth } from '@shared/personal/timesheet-rules';
import { leaveDaysRemaining } from '@shared/personal/leave-days';
import { useTimesheet } from './useTimesheet';
import { useLeaves } from './useLeaves';
import { StaffFormDrawer } from './StaffFormDrawer';
import type { Group, GroupTeamMember } from '@contracts/record-types.mjs';
import styles from './StaffProfilePage.module.css';

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
    return (
      <>
        <button type="button" className={styles.backLink} onClick={() => navigate('/personal')}>
          ← Personal
        </button>
        <p className={styles.notice}>Fișa nu a putut fi găsită.</p>
      </>
    );
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
      toast.show({ message: (error as Error).message });
    }
  }

  const branchTag = bothBranchesLabel(staff, branchIds);
  const birthday = birthdayTag(staff.birth);

  return (
    <>
      <p className={styles.breadcrumb}>
        <button type="button" onClick={() => navigate('/personal')}>
          Personal
        </button>{' '}
        / {staff.name}
      </p>

      <Card tone="orange" decorative className={styles.profileHeader}>
        <span className={styles.profileAvatar}>{initials(staff.name)}</span>
        <div className={styles.profileHeadInfo}>
          <h2 className={styles.profileName}>{staff.name}</h2>
          <p className={styles.profileMeta}>
            {personal.roleName(staff.roleId)}
            <span className={styles.profileBadgeMint}>{staff.archivedAt ? 'Nu mai lucrează' : 'Activ'}</span>
            {(branchTag || birthday) && (
              <span className={styles.profileBadgeOrange}>
                {[branchTag, birthday && `ziua de naștere ${birthday}`].filter(Boolean).join(' · ')}
              </span>
            )}
          </p>
        </div>
        <div className={styles.profileActions}>
          <Button variant="white" onClick={() => setEditOpen(true)}>
            Editează fișa
          </Button>
        </div>
      </Card>

      <div className={styles.profileGrid}>
        <div className={styles.profileLeft}>
          <Card className={styles.profileSection}>
            <p className={styles.sectionTitle}>Date personale</p>
            <p>Telefon: {staff.phone || '—'}</p>
            <p>IDNP: {staff.idnp || '—'}</p>
            <p>Adresă: {staff.address || '—'}</p>
            <p>Angajat din: {formatDate(staff.since)}</p>
          </Card>

          <Card className={styles.profileSection}>
            <p className={styles.sectionTitle}>Grupe</p>
            {staffGroups.length === 0 && <p className={styles.notice}>Fără grupă asignată.</p>}
            {staffGroups.map(({ group, entry }) => (
              <p key={group.id}>
                {group.name} · {entry.role === 'principal' ? 'principal' : entry.role === 'asistent' ? 'asistent' : 'înlocuitor'}
              </p>
            ))}
          </Card>

          <Card tone="yellow" className={styles.profileSection}>
            <p className={styles.sectionTitle}>Note</p>
            {staff.notes.length === 0 && <p>Fără note.</p>}
            {staff.notes.map(note => (
              <p key={note.at}>
                {formatDate(note.at)} — {note.text}
              </p>
            ))}
          </Card>

          <Button variant="outline" onClick={() => setArchiveConfirmOpen(true)}>
            Nu mai lucrează aici
          </Button>
        </div>

        <div className={styles.profileRight}>
          <div className={styles.miniCards}>
            <Card tone="mint" className={styles.miniCard}>
              <span>Zile lucrate · boală</span>
              <strong>
                {timesheetSummary.worked} · {timesheetSummary.cm}
              </strong>
            </Card>
            <Card tone="yellow" className={styles.miniCard}>
              <span>Concediu rămas</span>
              <strong>
                {remaining.remaining} din {personal.settings.annualLeaveDays}
              </strong>
              {remaining.planned > 0 && <small>{remaining.planned} planificate</small>}
            </Card>
            <Card className={styles.miniCard}>
              <span>Salariu</span>
              <strong>•••••</strong>
              <button type="button" className={styles.salaryLink} onClick={() => navigate('/personal?tab=salarii')}>
                Vezi cu PIN →
              </button>
            </Card>
          </div>

          <Card className={styles.profileSection}>
            <p className={styles.sectionTitle}>Pontajul lunii</p>
            <div className={styles.dotsRow}>
              {timesheetSummary.cells.map(cell => (
                <span
                  key={cell.date}
                  className={styles.dot}
                  title={cell.date}
                  data-kind={cell.kind || 'worked'}
                >
                  {cell.kind && cell.kind !== 'off' && cell.kind !== 'none' && cell.kind !== 'future'
                    ? TIMESHEET_CELL_LABEL[cell.kind] ?? ''
                    : ''}
                </span>
              ))}
            </div>
          </Card>

          <Card className={styles.profileSection}>
            <p className={styles.sectionTitle}>Concediile anului</p>
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
          </Card>
        </div>
      </div>

      <StaffFormDrawer target={editOpen ? staff : null} onClose={() => setEditOpen(false)} />

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
