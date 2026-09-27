import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, FilterPills, LoadingState, SearchInput, type PillTone } from '@shared/ui';
import { requestJson, useAppSession } from '@shared/api/session';
import { today } from '#shared/domain/calendar-month.mjs';
import { usePersonal } from '@shared/personal/usePersonal';
import { bothBranchesLabel, birthdayTag, initials } from '@shared/personal/staff-labels';
import { StaffFormDrawer } from './StaffFormDrawer';
import { RolesDrawer } from './RolesDrawer';
import type { Staff, TimesheetRow } from '@shared/personal/personal.types';
import type { Group } from '@contracts/record-types.mjs';
import styles from './TeamView.module.css';

export interface TeamViewProps {
  onOpenStaff: (id: string) => void;
}

type SortKey = 'name' | 'role' | 'group';

const DEPARTMENT_TONES: PillTone[] = ['orange', 'mint', 'yellow', 'pink'];

function groupAndRoleLabel(staffId: string, groups: Group[]): string {
  for (const group of groups) {
    const entry = group.team?.find(member => member.staffId === staffId);
    if (entry) {
      const roleLabel = entry.role === 'principal' ? 'principal' : entry.role === 'asistent' ? 'asistent' : 'înlocuitor';
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

/** Echipa (23a): tabel grupat pe departamente, cu filtru și sortare din antet. Rând → fișa angajatului (23j). */
export function TeamView({ onOpenStaff }: TeamViewProps) {
  const personal = usePersonal();
  const session = useAppSession();
  const groups = (session.state.state?.groups ?? []) as Group[];
  const branchIds = session.state.branches.map(branch => branch.id);

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [staffFormTarget, setStaffFormTarget] = useState<Staff | 'new' | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [todayCodes, setTodayCodes] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const month = today().slice(0, 7);
    requestJson(`/api/personal/timesheet?month=${month}`)
      .then(response => {
        const rows = (response as { rows: TimesheetRow[] }).rows;
        const todayStr = today();
        const codes = new Map<string, string>();
        for (const row of rows) if (row.date === todayStr) codes.set(row.staffId, row.code);
        setTodayCodes(codes);
      })
      .catch(() => setTodayCodes(new Map()));
  }, []);

  const departmentTone = useMemo(() => {
    const sorted = [...personal.departments].sort((a, b) => a.order - b.order);
    return new Map(sorted.map((department, index) => [department.id, DEPARTMENT_TONES[index % DEPARTMENT_TONES.length]]));
  }, [personal.departments]);

  const activeStaff = personal.staff.filter(person => !person.archivedAt);

  const filteredStaff = useMemo(() => {
    const normalizedQuery = search.trim().toLocaleLowerCase('ro-RO');
    return activeStaff.filter(person => {
      const departmentId = personal.roleDepartmentId(person.roleId);
      if (departmentFilter !== 'all' && departmentId !== departmentFilter) return false;
      if (normalizedQuery && !person.name.toLocaleLowerCase('ro-RO').includes(normalizedQuery)) return false;
      return true;
    });
  }, [activeStaff, departmentFilter, search, personal]);

  function sortValue(person: Staff): string {
    if (sort === 'role') return personal.roleName(person.roleId);
    if (sort === 'group') return groupAndRoleLabel(person.id, groups);
    return person.name;
  }

  const departmentsSorted = [...personal.departments].sort((a, b) => a.order - b.order);
  const groupedByDepartment = departmentsSorted
    .map(department => ({
      department,
      staff: filteredStaff
        .filter(person => personal.roleDepartmentId(person.roleId) === department.id)
        .sort((a, b) => sortValue(a).localeCompare(sortValue(b), 'ro')),
    }))
    .filter(group => group.staff.length > 0);

  if (personal.status === 'loading') return <LoadingState />;
  if (personal.status === 'failed')
    return <p className={styles.notice}>{personal.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <SearchInput value={search} onChange={setSearch} ariaLabel="Caută angajat" placeholder="Caută angajat" />
        <Button variant="outline" onClick={() => setRolesOpen(true)}>
          Funcții
        </Button>
        <Button onClick={() => setStaffFormTarget('new')}>+ Angajat</Button>
      </div>

      <FilterPills
        groups={[
          {
            label: 'Departament',
            value: departmentFilter,
            onChange: setDepartmentFilter,
            options: [
              { value: 'all', label: 'Toate', tone: 'neutral' as PillTone },
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
        <div className={styles.headRow}>
          <button type="button" className={styles.sortButton} onClick={() => setSort('name')}>
            Angajat
          </button>
          <button type="button" className={styles.sortButton} onClick={() => setSort('role')}>
            Funcția
          </button>
          <button type="button" className={styles.sortButton} onClick={() => setSort('group')}>
            Grupa și rolul
          </button>
          <span>Azi</span>
          <span>Telefon</span>
        </div>

        {groupedByDepartment.length === 0 && <p className={styles.notice}>Niciun angajat găsit.</p>}

        {groupedByDepartment.map(({ department, staff }) => (
          <div key={department.id}>
            <div className={styles.departmentHead}>
              <span
                className={styles.departmentSquare}
                style={{ background: `var(--${departmentTone.get(department.id)}-soft, var(--neutral-soft))` }}
                aria-hidden
              />
              <strong>{department.name}</strong>
              <span className={styles.departmentCount}>{staff.length}</span>
            </div>
            {staff.map(person => {
              const tag = bothBranchesLabel(person, branchIds);
              const birthday = birthdayTag(person.birth);
              return (
                <div
                  key={person.id}
                  className={styles.row}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenStaff(person.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') onOpenStaff(person.id);
                  }}
                >
                  <span className={styles.nameCell}>
                    <span className={styles.avatar}>{initials(person.name)}</span>
                    <span>
                      <strong>{person.name}</strong>
                      {(tag || birthday) && (
                        <span className={styles.tagLine}>
                          {[tag, birthday && `ziua de naștere ${birthday}`].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>
                  </span>
                  <span>{personal.roleName(person.roleId)}</span>
                  <span>{groupAndRoleLabel(person.id, groups)}</span>
                  <span>
                    <Badge tone={todayCodes.get(person.id) === 'CO' || todayCodes.get(person.id) === 'CM' ? 'yellow' : 'mint'}>
                      {todayBadgeLabel(todayCodes.get(person.id) as TimesheetRow['code'])}
                    </Badge>
                  </span>
                  <span>{person.phone || '—'}</span>
                </div>
              );
            })}
          </div>
        ))}
      </Card>

      <StaffFormDrawer target={staffFormTarget} onClose={() => setStaffFormTarget(null)} />
      <RolesDrawer open={rolesOpen} onClose={() => setRolesOpen(false)} />
    </div>
  );
}
