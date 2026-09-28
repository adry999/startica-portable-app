import { useState } from 'react';
import { Badge, SearchInput } from '@shared/ui';
import { initials } from '@shared/format/initials';
import type { Staff, Leave } from '@shared/personal/personal.types';
import type { GroupTeamMember } from '@contracts/record-types.mjs';
import styles from './GroupTeamPicker.module.css';

export interface GroupTeamPickerAllGroup {
  id: string;
  name: string;
  team: GroupTeamMember[];
}

export interface GroupTeamPickerProps {
  /** null pentru grupa nouă (4c), care încă nu are id. */
  currentGroupId: string | null;
  team: GroupTeamMember[];
  onChange: (team: GroupTeamMember[]) => void;
  staff: Staff[];
  roleName: (roleId: string) => string;
  allGroups: GroupTeamPickerAllGroup[];
  leaves: Leave[];
  /** Rândul de zile L-V apare doar în 4a (Carduri), nu în 4c (Grupă nouă). */
  showDays: boolean;
}

type Role = GroupTeamMember['role'];

const ROLE_ORDER: Role[] = ['principal', 'asistent', 'inlocuitor'];
const ROLE_TITLE: Record<Role, string> = { principal: 'Principal', asistent: 'Asistent', inlocuitor: 'Înlocuitor' };
const ROLE_TONE: Record<Role, 'orange' | 'mint' | 'neutral'> = {
  principal: 'orange',
  asistent: 'mint',
  inlocuitor: 'neutral',
};
const ROLE_ADD_LABEL: Record<Role, string> = {
  principal: '+ Alege',
  asistent: '+ Asistent',
  inlocuitor: '+ Înlocuitor',
};
const DAY_LABELS = ['L', 'Ma', 'Mi', 'J', 'V'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

function isEducatorRole(roleLabel: string): boolean {
  return roleLabel.toLocaleLowerCase('ro-RO').includes('educator');
}

/** Echipa grupei (03-grupe.md §5c) — principal/asistenți/înlocuitori aleși din Personal. */
export function GroupTeamPicker({
  currentGroupId,
  team,
  onChange,
  staff,
  roleName,
  allGroups,
  leaves,
  showDays,
}: GroupTeamPickerProps) {
  const [openRole, setOpenRole] = useState<Role | null>(null);
  const [query, setQuery] = useState('');

  const staffById = new Map(staff.map(person => [person.id, person]));
  const today = todayIso();

  const activeLeaveByStaffId = new Map<string, Leave>();
  for (const leave of leaves) {
    if (leave.from <= today && today <= leave.to) activeLeaveByStaffId.set(leave.staffId, leave);
  }

  // Unde lucrează deja fiecare persoană — pe orice altă grupă decât cea curentă.
  const otherAssignment = new Map<string, { groupName: string; role: Role }>();
  for (const group of allGroups) {
    if (group.id === currentGroupId) continue;
    for (const member of group.team ?? []) {
      if (!otherAssignment.has(member.staffId))
        otherAssignment.set(member.staffId, { groupName: group.name, role: member.role });
    }
  }

  function addMember(role: Role, staffId: string) {
    if (role === 'principal') {
      onChange([...team.filter(member => member.role !== 'principal'), { staffId, role }]);
    } else {
      onChange([...team, { staffId, role }]);
    }
    setOpenRole(null);
    setQuery('');
  }

  function removeMember(staffId: string, role: Role) {
    onChange(team.filter(member => !(member.staffId === staffId && member.role === role)));
  }

  function toggleDay(staffId: string, day: number) {
    onChange(
      team.map(member => {
        if (member.staffId !== staffId) return member;
        const days = member.days ?? [];
        const nextDays = days.includes(day) ? days.filter(value => value !== day) : [...days, day].sort();
        return { ...member, days: nextDays };
      }),
    );
  }

  function candidatesFor() {
    const assigned = new Set(team.map(member => member.staffId));
    const trimmed = query.trim().toLocaleLowerCase('ro-RO');
    return staff
      .filter(person => !person.archivedAt && !assigned.has(person.id))
      .filter(person => !trimmed || person.name.toLocaleLowerCase('ro-RO').includes(trimmed))
      .sort((a, b) => {
        const tierOf = (person: Staff) => {
          if (isEducatorRole(roleName(person.roleId))) return 0;
          if (!otherAssignment.has(person.id)) return 1;
          return 2;
        };
        const tierDiff = tierOf(a) - tierOf(b);
        if (tierDiff !== 0) return tierDiff;
        return a.name.localeCompare(b.name, 'ro');
      });
  }

  return (
    <div className={styles.root}>
      <p className={styles.title}>Echipa grupei</p>
      <div className={showDays ? styles.blocksRow : styles.blocksColumn}>
        {ROLE_ORDER.map(role => {
          const members = team.filter(member => member.role === role);
          const isOpen = openRole === role;
          return (
            <div key={role} className={styles.block}>
              <div className={styles.blockHead}>
                <Badge tone={ROLE_TONE[role]}>{ROLE_TITLE[role]}</Badge>
              </div>

              {members.length === 0 && (
                <p className={role === 'principal' ? styles.emptyPrincipal : styles.emptyOther}>
                  {role === 'principal'
                    ? 'Fără educator principal'
                    : role === 'asistent'
                      ? 'Niciun asistent'
                      : 'Niciun înlocuitor'}
                </p>
              )}

              <ul className={styles.list}>
                {members.map(member => {
                  const person = staffById.get(member.staffId);
                  const leave = activeLeaveByStaffId.get(member.staffId);
                  return (
                    <li key={member.staffId} className={styles.row}>
                      <span className={styles.avatar}>{initials(person?.name ?? '?')}</span>
                      <span className={styles.name}>
                        {person?.name ?? member.staffId}
                        {person && <span className={styles.function}>{roleName(person.roleId)}</span>}
                      </span>
                      {leave && <Badge tone="yellow">Concediu până pe {shortDate(leave.to)}</Badge>}
                      {showDays && (
                        <span className={styles.days}>
                          {DAY_LABELS.map((label, index) => (
                            <button
                              key={label}
                              type="button"
                              className={(member.days ?? []).includes(index + 1) ? styles.dayActive : styles.day}
                              onClick={() => toggleDay(member.staffId, index + 1)}
                            >
                              {label}
                            </button>
                          ))}
                        </span>
                      )}
                      <button
                        type="button"
                        className={styles.removeButton}
                        aria-label={`Scoate ${person?.name ?? ''} din echipă`}
                        onClick={() => removeMember(member.staffId, role)}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>

              <button type="button" className={styles.addButton} onClick={() => setOpenRole(isOpen ? null : role)}>
                {role === 'principal' && members.length > 0 ? 'Schimbă' : ROLE_ADD_LABEL[role]}
              </button>

              {isOpen && (
                <div className={styles.searchPanel}>
                  <SearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder="Caută în Personal…"
                    ariaLabel="Caută în Personal"
                  />
                  <ul className={styles.candidateList}>
                    {candidatesFor().map(person => {
                      const other = otherAssignment.get(person.id);
                      return (
                        <li key={person.id}>
                          <button
                            type="button"
                            className={styles.candidateRow}
                            onClick={() => addMember(role, person.id)}
                          >
                            <span className={styles.avatar}>{initials(person.name)}</span>
                            <span className={styles.name}>{person.name}</span>
                            {other ? (
                              <Badge tone={other.role === 'principal' ? 'orange' : 'neutral'}>
                                {other.groupName} ·{' '}
                                {other.role === 'principal'
                                  ? 'principal'
                                  : other.role === 'asistent'
                                    ? 'asistent'
                                    : 'înlocuitor'}
                              </Badge>
                            ) : (
                              <Badge tone="mint">Liberă</Badge>
                            )}
                          </button>
                        </li>
                      );
                    })}
                    {candidatesFor().length === 0 && <li className={styles.noMatch}>Nimeni disponibil.</li>}
                  </ul>
                  <p className={styles.hireLink}>Lipsește cineva? Personal → + Angajat</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
