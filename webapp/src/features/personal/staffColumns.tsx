import { Badge, PersonCell, type DataTableColumn } from '@shared/ui';
import { bothBranchesLabel, birthdayTag } from '@shared/personal/staff-labels';
import type { Staff, TimesheetRow } from '@shared/personal/personal.types';
import type { Group } from '@contracts/record-types.mjs';

export interface StaffColumnsOptions {
  groups: Group[];
  branchIds: string[];
  roleName: (roleId: string) => string;
  todayCodes: Map<string, string>;
}

/** „<grupă> · <rol>” pentru coloana Grupa și rolul (23a) — un angajat apare într-o singură grupă. */
export function groupAndRoleLabel(staffId: string, groups: Group[]): string {
  for (const group of groups) {
    const entry = group.team?.find(member => member.staffId === staffId);
    if (entry) {
      const roleLabel =
        entry.role === 'principal' ? 'principal' : entry.role === 'asistent' ? 'asistent' : 'înlocuitor';
      return `${group.name} · ${roleLabel}`;
    }
  }
  return '—';
}

/** Codul de azi din pontaj → eticheta din 23a (La lucru / Concediu / Boală). */
function todayBadgeLabel(code: TimesheetRow['code'] | '' | undefined): string {
  if (code === 'CO') return 'Concediu';
  if (code === 'CM') return 'Boală';
  if (code === 'A') return 'Absent';
  return 'La lucru';
}

export function buildStaffColumns({ groups, branchIds, roleName, todayCodes }: StaffColumnsOptions): DataTableColumn<Staff>[] {
  return [
    {
      key: 'name',
      header: 'Angajat',
      sortValue: person => person.name,
      render: person => {
        const tag = bothBranchesLabel(person, branchIds);
        const birthday = birthdayTag(person.birth);
        return (
          <PersonCell
            name={person.name}
            sub={[tag, birthday && `ziua de naștere ${birthday}`].filter(Boolean).join(' · ') || undefined}
          />
        );
      },
    },
    {
      key: 'role',
      header: 'Funcția',
      sortValue: person => roleName(person.roleId),
      render: person => roleName(person.roleId),
    },
    {
      key: 'group',
      header: 'Grupa și rolul',
      sortValue: person => groupAndRoleLabel(person.id, groups),
      render: person => groupAndRoleLabel(person.id, groups),
    },
    {
      key: 'today',
      header: 'Azi',
      render: person => {
        const code = todayCodes.get(person.id);
        return (
          <Badge tone={code === 'CO' || code === 'CM' ? 'yellow' : 'mint'}>
            {todayBadgeLabel(code as TimesheetRow['code'])}
          </Badge>
        );
      },
    },
    {
      key: 'phone',
      header: 'Telefon',
      render: person => person.phone || '—',
    },
  ];
}
