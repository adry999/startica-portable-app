import { Badge, groupTone, type BadgeTone, type DataTableColumn, type PillTone } from '@shared/ui';
import { initials } from '@shared/format/initials';
import { bothBranchesLabel, birthdayTag } from '@shared/personal/staff-labels';
import type { Staff, TimesheetRow } from '@shared/personal/personal.types';
import type { Group } from '@contracts/record-types.mjs';
import styles from './TeamView.module.css';

export interface StaffColumnsOptions {
  groups: Group[];
  branchIds: string[];
  roleName: (roleId: string) => string;
  todayCodes: Map<string, string>;
  departmentTone: (roleId: string) => PillTone;
}

interface GroupMembership {
  groupId: string;
  groupName: string;
  role: 'principal' | 'asistent' | 'inlocuitor';
}

/** Grupa (dacă există) în care apare angajatul — un angajat apare într-o singură grupă. */
function findGroupMembership(staffId: string, groups: Group[]): GroupMembership | null {
  for (const group of groups) {
    const entry = group.team?.find(member => member.staffId === staffId);
    if (entry) return { groupId: group.id, groupName: group.name, role: entry.role };
  }
  return null;
}

const GROUP_ROLE_LABEL: Record<GroupMembership['role'], string> = {
  principal: 'principal',
  asistent: 'asistent',
  inlocuitor: 'înlocuitor',
};

/** „<grupă> · <rol>” pentru coloana Grupa și rolul (23a). */
export function groupAndRoleLabel(staffId: string, groups: Group[]): string {
  const membership = findGroupMembership(staffId, groups);
  return membership ? `${membership.groupName} · ${GROUP_ROLE_LABEL[membership.role]}` : '—';
}

/** CO și CM țin angajatul departe de lucru azi — folosit și la numărătoarea din antet (23a),
 * ca să nu se dubleze regula „cine e în concediu azi” în două locuri. */
export function isAwayToday(code: TimesheetRow['code'] | '' | undefined): boolean {
  return code === 'CO' || code === 'CM';
}

const TODAY_BADGE: Record<'CO' | 'CM' | 'A', { label: string; tone: BadgeTone }> = {
  CO: { label: 'CO', tone: 'yellow' },
  CM: { label: 'CM', tone: 'pink' },
  A: { label: 'A', tone: 'neutral' },
};

export function buildStaffColumns({
  groups,
  branchIds,
  roleName,
  todayCodes,
  departmentTone,
}: StaffColumnsOptions): DataTableColumn<Staff>[] {
  return [
    {
      key: 'name',
      header: 'Angajat',
      sortValue: person => person.name,
      render: person => {
        const tag = bothBranchesLabel(person, branchIds);
        const birthday = birthdayTag(person.birth);
        const sub = [tag, birthday && `ziua de naștere ${birthday}`].filter(Boolean).join(' · ');
        return (
          <div className={styles.employeeCell}>
            <span className={`${styles.employeeAvatar} ${styles[departmentTone(person.roleId)]}`}>
              {initials(person.name)}
            </span>
            <span className={styles.employeeText}>
              <strong className={styles.employeeName}>{person.name}</strong>
              {sub && <small className={styles.employeeSub}>{sub}</small>}
            </span>
          </div>
        );
      },
    },
    {
      key: 'role',
      header: 'Funcția',
      sortValue: person => roleName(person.roleId),
      render: person => <span className={styles.roleCell}>{roleName(person.roleId)}</span>,
    },
    {
      key: 'group',
      header: 'Grupa și rolul',
      sortValue: person => groupAndRoleLabel(person.id, groups),
      render: person => {
        const membership = findGroupMembership(person.id, groups);
        if (!membership) return <span className={styles.noGroup}>—</span>;
        return (
          <Badge tone={groupTone(membership.groupId, groups)}>
            {membership.groupName} · {GROUP_ROLE_LABEL[membership.role]}
          </Badge>
        );
      },
    },
    {
      key: 'phone',
      header: 'Telefon',
      render: person => person.phone || '—',
    },
    {
      key: 'today',
      header: 'Azi',
      render: person => {
        const code = todayCodes.get(person.id) as TimesheetRow['code'] | undefined;
        const badge = code === 'CO' || code === 'CM' || code === 'A' ? TODAY_BADGE[code] : null;
        return <Badge tone={badge?.tone ?? 'mint'}>{badge?.label ?? 'La lucru'}</Badge>;
      },
    },
  ];
}
