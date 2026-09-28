import { fail } from '#core/server/errors/domain-error.mjs';
import { normalizePersonalRecord, isStaffInBranch } from '../domain/personal-schema.mjs';
import { seedDepartments, seedRoles, DEFAULT_PERSONAL_SETTINGS } from '../domain/personal-seeds.mjs';

/** @typedef {import('../personal.types.d.mts').Staff} Staff */
/** @typedef {import('../personal.types.d.mts').TimesheetRow} TimesheetRow */
/** @typedef {import('../personal.types.d.mts').PersonalSettings} PersonalSettings */
/**
 * Portul primit de la `app/` (nu tipul complet `CommonContext` — Personal nu are voie să
 * importe din `#app/`): doar ce foloseşte repository-ul din baza comună.
 * @typedef {{
 *   kinds: import('#core/server/persistence/kind-repository.mjs').KindRepository,
 *   readSetting: (key: string) => string,
 *   writeSetting: (key: string, value: string) => void,
 * }} CommonContextPort
 */

const PERSONAL_SETTINGS_KEY = 'personalSettings';

/** @param {string} staffId @param {string} date */
const timesheetRowId = (staffId, date) => `TS-${staffId}-${date}`;

/**
 * Împachetează `common.kinds` cu semințele scrise o singură dată (baza comună nou creată)
 * și interogările tipate ale Personal 24.
 * @param {CommonContextPort} common
 */
export function createPersonalRepository(common) {
  const kinds = common.kinds;

  // Semințele (întrebarea 2 din plan): scrise o singură dată, cât timp AMBELE liste sunt
  // goale — o filială care le-a editat deja (ștergând tot, de exemplu) nu le vede reapărând.
  if (kinds.list('departments').length === 0 && kinds.list('roles').length === 0) {
    kinds.transaction(() => {
      for (const department of seedDepartments()) kinds.save('departments', department);
      for (const role of seedRoles()) kinds.save('roles', role);
    });
  }

  /** @returns {import('../personal.types.d.mts').Department[]} */
  function departments() {
    return kinds.list('departments');
  }

  /** @returns {import('../personal.types.d.mts').Role[]} */
  function roles() {
    return kinds.list('roles');
  }

  /** @returns {Staff[]} */
  function allStaff() {
    return kinds.list('staff');
  }

  /** @param {string} branchId @returns {Staff[]} */
  function staffForBranch(branchId) {
    return allStaff().filter(staff => isStaffInBranch(staff, branchId));
  }

  /** @param {string} roleId @returns {boolean} */
  function roleHasStaff(roleId) {
    return allStaff().some(staff => staff.roleId === roleId && !staff.archivedAt);
  }

  /** @param {unknown} input @param {'create' | 'update'} mode @returns {Staff} */
  function saveStaff(input, mode) {
    const normalized = normalizePersonalRecord('staff', input);
    const existing = kinds.find('staff', normalized.id);
    if (mode === 'create' && existing) fail('ID deja folosit.', 409);
    if (mode === 'update' && !existing) fail('Angajatul nu mai există.', 409);
    if (!roles().some(role => role.id === normalized.roleId)) fail('Funcție inexistentă.');
    kinds.save('staff', normalized);
    return normalized;
  }

  /** @param {string} id @param {string} archivedAt @returns {Staff} */
  function archiveStaff(id, archivedAt) {
    const existing = kinds.find('staff', id);
    if (!existing) fail('Angajatul nu mai există.', 409);
    const updated = normalizePersonalRecord('staff', { ...existing, archivedAt });
    kinds.save('staff', updated);
    return updated;
  }

  /**
   * Listele complete (23e) — o funcție cu angajați nu se poate șterge, doar redenumi.
   * @param {unknown[]} newDepartments
   * @param {unknown[]} newRoles
   */
  function replaceDepartmentsAndRoles(newDepartments, newRoles) {
    if (!Array.isArray(newDepartments) || !Array.isArray(newRoles)) fail('Listă invalidă.');
    const normalizedDepartments = newDepartments.map(department => normalizePersonalRecord('departments', department));
    const normalizedRoles = newRoles.map(role => normalizePersonalRecord('roles', role));
    const departmentIds = new Set(normalizedDepartments.map(department => department.id));
    for (const role of normalizedRoles)
      if (!departmentIds.has(role.departmentId)) fail(`Departament inexistent pentru funcția „${role.name}”.`);
    const keptRoleIds = new Set(normalizedRoles.map(role => role.id));
    for (const role of roles())
      if (!keptRoleIds.has(role.id) && roleHasStaff(role.id))
        fail(`Funcția „${role.name}” are angajați — nu poate fi ștearsă, doar redenumită.`);
    return kinds.transaction(() => {
      for (const role of roles()) if (!keptRoleIds.has(role.id)) kinds.remove('roles', role.id);
      const keptDepartmentIds = new Set(normalizedDepartments.map(department => department.id));
      for (const department of departments())
        if (!keptDepartmentIds.has(department.id)) kinds.remove('departments', department.id);
      for (const department of normalizedDepartments) kinds.save('departments', department);
      for (const role of normalizedRoles) kinds.save('roles', role);
      return { departments: normalizedDepartments, roles: normalizedRoles };
    });
  }

  /** @param {string} month YYYY-MM @param {string[] | null} [staffIds] @returns {TimesheetRow[]} */
  function timesheetForMonth(month, staffIds = null) {
    const rows = kinds.list('timesheet').filter(row => row.date.startsWith(month));
    if (!staffIds) return rows;
    const allowed = new Set(staffIds);
    return rows.filter(row => allowed.has(row.staffId));
  }

  /**
   * O singură tranzacție pentru tot lotul (precedentul attendance): `code: null` șterge rândul
   * (= lucrat 8 h), altfel scrie codul. Nicio verificare de zi viitoare — un concediu planificat
   * scrie dinainte.
   * @param {{ staffId: string, date: string, code: string | null }[]} changes
   */
  function applyTimesheetChanges(changes) {
    return kinds.transaction(() => {
      const saved = [];
      const removed = [];
      for (const change of changes) {
        const id = timesheetRowId(change.staffId, change.date);
        if (change.code === null) {
          kinds.remove('timesheet', id);
          removed.push({ staffId: change.staffId, date: change.date });
        } else {
          const row = normalizePersonalRecord('timesheet', {
            id,
            staffId: change.staffId,
            date: change.date,
            code: change.code,
          });
          kinds.save('timesheet', row);
          saved.push(row);
        }
      }
      return { saved, removed };
    });
  }

  /** @param {string} year YYYY @param {string[] | null} [staffIds] @returns {import('../personal.types.d.mts').Leave[]} */
  function leavesForYear(year, staffIds = null) {
    const rows = kinds.list('leaves').filter(leave => leave.from.slice(0, 4) === year || leave.to.slice(0, 4) === year);
    if (!staffIds) return rows;
    const allowed = new Set(staffIds);
    return rows.filter(leave => allowed.has(leave.staffId));
  }

  /** @param {string} staffId @returns {import('../personal.types.d.mts').Salary[]} */
  function salariesForStaff(staffId) {
    return kinds.list('salaries').filter(salary => salary.staffId === staffId);
  }

  /** @param {unknown} input @returns {import('../personal.types.d.mts').Salary} */
  function saveSalary(input) {
    const normalized = normalizePersonalRecord('salaries', input);
    if (!kinds.find('staff', normalized.staffId)) fail('Angajatul nu mai există.', 409);
    kinds.save('salaries', normalized);
    return normalized;
  }

  /** @param {string} month YYYY-MM @param {string[] | null} [staffIds] @returns {import('../personal.types.d.mts').Advance[]} */
  function advancesForMonth(month, staffIds = null) {
    const rows = kinds.list('advances').filter(advance => advance.month === month);
    if (!staffIds) return rows;
    const allowed = new Set(staffIds);
    return rows.filter(advance => allowed.has(advance.staffId));
  }

  /** @param {string} year YYYY @param {string[] | null} [staffIds] @returns {import('../personal.types.d.mts').Advance[]} */
  function advancesForYear(year, staffIds = null) {
    const rows = kinds.list('advances').filter(advance => advance.date.slice(0, 4) === year);
    if (!staffIds) return rows;
    const allowed = new Set(staffIds);
    return rows.filter(advance => allowed.has(advance.staffId));
  }

  /** @param {string} staffId @param {string} month @param {string} branchId */
  function salaryPaymentId(staffId, month, branchId) {
    return `SP-${staffId}-${month}-${branchId}`;
  }

  /** @returns {import('../personal.types.d.mts').Candidate[]} */
  function candidates() {
    return kinds.list('candidates');
  }

  /** @param {unknown} input @param {'create' | 'update'} mode @returns {import('../personal.types.d.mts').Candidate} */
  function saveCandidate(input, mode) {
    const now = new Date().toISOString();
    const existing = mode === 'update' ? kinds.find('candidates', /** @type {any} */ (input)?.id) : null;
    if (mode === 'update' && !existing) fail('Candidatul nu mai există.', 409);
    const normalized = normalizePersonalRecord('candidates', {
      ...input,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    kinds.save('candidates', normalized);
    return normalized;
  }

  /** @param {string} id */
  function deleteCandidate(id) {
    const existing = kinds.find('candidates', id);
    if (!existing) fail('Candidatul nu mai există.', 409);
    kinds.remove('candidates', id);
    return existing;
  }

  /** @returns {PersonalSettings} */
  function readSettings() {
    const raw = common.readSetting(PERSONAL_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_PERSONAL_SETTINGS };
    try {
      const parsed = JSON.parse(raw);
      return {
        annualLeaveDays: Number.isFinite(parsed.annualLeaveDays)
          ? parsed.annualLeaveDays
          : DEFAULT_PERSONAL_SETTINGS.annualLeaveDays,
        deductOnlyUnexcused:
          typeof parsed.deductOnlyUnexcused === 'boolean'
            ? parsed.deductOnlyUnexcused
            : DEFAULT_PERSONAL_SETTINGS.deductOnlyUnexcused,
      };
    } catch {
      return { ...DEFAULT_PERSONAL_SETTINGS };
    }
  }

  /** @param {{ annualLeaveDays?: unknown, deductOnlyUnexcused?: unknown }} input @returns {PersonalSettings} */
  function writeSettings(input) {
    const current = readSettings();
    const annualLeaveDays = typeof input.annualLeaveDays === 'number' ? input.annualLeaveDays : current.annualLeaveDays;
    if (!Number.isInteger(annualLeaveDays) || annualLeaveDays < 0 || annualLeaveDays > 365)
      fail('Numărul de zile de concediu este invalid.');
    const deductOnlyUnexcused =
      typeof input.deductOnlyUnexcused === 'boolean' ? input.deductOnlyUnexcused : current.deductOnlyUnexcused;
    const settings = { annualLeaveDays, deductOnlyUnexcused };
    common.writeSetting(PERSONAL_SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  }

  return {
    kinds,
    departments,
    roles,
    allStaff,
    staffForBranch,
    roleHasStaff,
    saveStaff,
    archiveStaff,
    replaceDepartmentsAndRoles,
    timesheetForMonth,
    applyTimesheetChanges,
    leavesForYear,
    salariesForStaff,
    saveSalary,
    advancesForMonth,
    advancesForYear,
    salaryPaymentId,
    candidates,
    saveCandidate,
    deleteCandidate,
    readSettings,
    writeSettings,
  };
}

/** @typedef {ReturnType<typeof createPersonalRepository>} PersonalRepository */
