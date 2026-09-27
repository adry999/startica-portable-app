import { useSyncExternalStore } from 'react';
import { requestJson } from '@shared/api/session';
import type { Department, PersonalSettings, Role, Staff } from './personal.types';

export interface PersonalData {
  status: 'loading' | 'ready' | 'failed';
  failureMessage: string;
  departments: Department[];
  roles: Role[];
  staff: Staff[];
  settings: PersonalSettings;
  staffById: ReadonlyMap<string, Staff>;
  roleName: (roleId: string) => string;
  departmentName: (departmentId: string) => string;
  roleDepartmentId: (roleId: string) => string;
  reload: () => Promise<void>;
  saveStaff: (mode: 'create' | 'update', staff: Staff) => Promise<Staff>;
  archiveStaff: (id: string, archivedAt: string) => Promise<Staff>;
  saveRoles: (departments: Department[], roles: Role[]) => Promise<void>;
  saveSettings: (settings: PersonalSettings) => Promise<PersonalSettings>;
}

const DEFAULT_SETTINGS: PersonalSettings = { annualLeaveDays: 28, deductOnlyUnexcused: true };

interface StoreState {
  status: 'loading' | 'ready' | 'failed';
  failureMessage: string;
  departments: Department[];
  roles: Role[];
  staff: Staff[];
  settings: PersonalSettings;
}

let state: StoreState = {
  status: 'loading',
  failureMessage: '',
  departments: [],
  roles: [],
  staff: [],
  settings: DEFAULT_SETTINGS,
};
let bootstrapped = false;

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

function notify() {
  version += 1;
  for (const listener of listeners) listener();
}
function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function getVersion() {
  return version;
}

async function load(): Promise<void> {
  state = { ...state, status: 'loading' };
  notify();
  try {
    const response = (await requestJson('/api/personal/state')) as {
      departments: Department[];
      roles: Role[];
      staff: Staff[];
      settings?: PersonalSettings;
    };
    state = {
      status: 'ready',
      failureMessage: '',
      departments: response.departments,
      roles: response.roles,
      staff: response.staff,
      settings: response.settings ?? DEFAULT_SETTINGS,
    };
  } catch (error) {
    state = { ...state, status: 'failed', failureMessage: (error as Error).message };
  }
  notify();
}

/** Reîncarcă starea comună — apelat direct din teste (ca `session.load()`), fără să treacă prin hook. */
export function reloadPersonal(): Promise<void> {
  bootstrapped = true;
  return load();
}

/**
 * Store la nivel de modul (ca sesiunea din `@shared/api/session`) — Personal nu e în `/api/state`
 * (decizia 2 din plan), deci se încarcă separat, o singură dată, indiferent de câte ecrane îl cer
 * (Echipa, Pontaj, Concedii, fișă, echipa grupei).
 */
export function usePersonal(): PersonalData {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  if (!bootstrapped) {
    bootstrapped = true;
    void load();
  }

  const staffById = new Map(state.staff.map(person => [person.id, person]));
  const roleById = new Map(state.roles.map(role => [role.id, role]));
  const departmentById = new Map(state.departments.map(department => [department.id, department]));

  function roleName(roleId: string): string {
    return roleById.get(roleId)?.name ?? '';
  }
  function departmentName(departmentId: string): string {
    return departmentById.get(departmentId)?.name ?? '';
  }
  function roleDepartmentId(roleId: string): string {
    return roleById.get(roleId)?.departmentId ?? '';
  }

  async function saveStaff(mode: 'create' | 'update', staff: Staff): Promise<Staff> {
    const response = (await requestJson('/api/personal/staff', { mode, staff })) as { staff: Staff };
    await load();
    return response.staff;
  }

  async function archiveStaff(id: string, archivedAt: string): Promise<Staff> {
    const response = (await requestJson('/api/personal/staff-archive', { id, archivedAt })) as { staff: Staff };
    await load();
    return response.staff;
  }

  async function saveRoles(departments: Department[], roles: Role[]): Promise<void> {
    await requestJson('/api/personal/roles', { departments, roles });
    await load();
  }

  async function saveSettings(settings: PersonalSettings): Promise<PersonalSettings> {
    const response = (await requestJson('/api/personal/settings', settings)) as { settings: PersonalSettings };
    await load();
    return response.settings;
  }

  return {
    status: state.status,
    failureMessage: state.failureMessage,
    departments: state.departments,
    roles: state.roles,
    staff: state.staff,
    settings: state.settings,
    staffById,
    roleName,
    departmentName,
    roleDepartmentId,
    reload: reloadPersonal,
    saveStaff,
    archiveStaff,
    saveRoles,
    saveSettings,
  };
}
