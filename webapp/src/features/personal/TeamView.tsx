import { useEffect, useMemo, useState } from 'react';
import { Button, DataTable, FilterPills, LoadingState, SearchInput, type PillTone } from '@shared/ui';
import { requestJson, useAppSession } from '@shared/api/session';
import { today } from '#shared/domain/calendar-month.mjs';
import { usePersonal } from '@shared/personal/usePersonal';
import { StaffFormDrawer } from './StaffFormDrawer';
import { RolesDrawer } from './RolesDrawer';
import { buildStaffColumns, isAwayToday } from './staffColumns';
import type { Staff, TimesheetRow } from '@shared/personal/personal.types';
import type { Group } from '@contracts/record-types.mjs';
import styles from './TeamView.module.css';

export interface TeamViewProps {
  onOpenStaff: (id: string) => void;
  /** „+ Angajat” (23a) stă în antet, în PersonalPage — formularul rămâne aici, controlat de acolo. */
  staffFormTarget: Staff | 'new' | null;
  onCloseStaffForm: () => void;
  /** Deschide formularul de angajat nou — pentru acțiunea din starea goală `personal.first`. */
  onAddStaff: () => void;
}

const DEPARTMENT_TONES: PillTone[] = ['orange', 'mint', 'yellow', 'pink'];

/** Echipa (23a): tabel grupat pe departamente, cu filtru și sortare din antet. Rând → fișa angajatului (23j). */
export function TeamView({ onOpenStaff, staffFormTarget, onCloseStaffForm, onAddStaff }: TeamViewProps) {
  const personal = usePersonal();
  const session = useAppSession();
  const groups = (session.state.state?.groups ?? []) as Group[];
  const branchIds = session.state.branches.map(branch => branch.id);

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
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

  const departmentsSorted = useMemo(
    () => [...personal.departments].sort((a, b) => a.order - b.order),
    [personal.departments],
  );

  const departmentTone = useMemo(
    () =>
      new Map(
        departmentsSorted.map((department, index) => [
          department.id,
          DEPARTMENT_TONES[index % DEPARTMENT_TONES.length],
        ]),
      ),
    [departmentsSorted],
  );

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

  if (personal.status === 'loading') return <LoadingState />;
  if (personal.status === 'failed')
    return <p className={styles.notice}>{personal.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const columns = buildStaffColumns({
    groups,
    branchIds,
    roleName: roleId => personal.roleName(roleId),
    todayCodes,
    departmentTone: roleId => departmentTone.get(personal.roleDepartmentId(roleId) ?? '') ?? 'neutral',
  });

  const onLeaveCount = filteredStaff.filter(person =>
    isAwayToday(todayCodes.get(person.id) as TimesheetRow['code'] | undefined),
  ).length;
  const staffCountLabel = `${filteredStaff.length} angajat${filteredStaff.length === 1 ? '' : 'i'}`;
  const departmentOptions: { value: string; label: string; tone: PillTone }[] = [
    { value: 'all', label: 'Toate', tone: 'neutral' },
    ...departmentsSorted.map(department => ({
      value: department.id,
      label: department.name,
      tone: departmentTone.get(department.id) ?? ('neutral' as PillTone),
    })),
  ];

  const activeFilterLabels: string[] = [];
  if (search) activeFilterLabels.push(`Căutare: ${search}`);
  if (departmentFilter !== 'all') {
    activeFilterLabels.push(departmentsSorted.find(department => department.id === departmentFilter)?.name ?? '');
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <SearchInput
          className={styles.search}
          value={search}
          onChange={setSearch}
          ariaLabel="Caută angajat"
          placeholder="Caută angajat"
        />
        <FilterPills
          className={styles.inlinePills}
          groups={[
            {
              label: 'Departament',
              options: departmentOptions,
              value: departmentFilter,
              onChange: setDepartmentFilter,
            },
          ]}
        />
        <span className={styles.trailing}>
          {staffCountLabel} · {onLeaveCount} în concediu azi
        </span>
        <Button variant="outline" onClick={() => setRolesOpen(true)}>
          Funcții
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={filteredStaff}
        rowKey={person => person.id}
        onRowClick={person => onOpenStaff(person.id)}
        empty="personal.first"
        onEmptyAction={onAddStaff}
        hasActiveFilters={activeFilterLabels.length > 0}
        activeFilterLabels={activeFilterLabels}
        onClearFilters={() => {
          setSearch('');
          setDepartmentFilter('all');
        }}
        groupBy={{
          key: person => personal.roleDepartmentId(person.roleId) ?? '',
          order: departmentsSorted.map(department => department.id),
          label: departmentId => {
            const department = departmentsSorted.find(item => item.id === departmentId);
            const count = filteredStaff.filter(
              person => personal.roleDepartmentId(person.roleId) === departmentId,
            ).length;
            return (
              <span className={styles.departmentHead}>
                <span
                  className={styles.departmentSquare}
                  style={{ background: `var(--${departmentTone.get(departmentId)}-soft, var(--neutral-soft))` }}
                  aria-hidden
                />
                <strong>{department?.name ?? '—'}</strong>
                <span className={styles.departmentCount}>{count}</span>
              </span>
            );
          },
        }}
      />

      {/* C2: 'closed' distinct de 'new' — altfel a doua „+ Angajat” reia instanța (și
          valorile) primei, în loc să pornească de la un formular gol. */}
      <StaffFormDrawer
        key={staffFormTarget === null ? 'closed' : staffFormTarget === 'new' ? 'new' : staffFormTarget.id}
        target={staffFormTarget}
        onClose={onCloseStaffForm}
      />
      <RolesDrawer open={rolesOpen} onClose={() => setRolesOpen(false)} />
    </div>
  );
}
