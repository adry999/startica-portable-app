import { normalizePersonalRecord } from '../domain/personal-schema.mjs';

/** @typedef {import('../personal.types.d.mts').Staff} Staff */
/** @typedef {import('../personal.types.d.mts').Department} Department */
/** @typedef {import('../personal.types.d.mts').Role} Role */
/** @typedef {import('../personal.types.d.mts').Leave} Leave */

/** @param {Partial<Department>} [overrides] @returns {Department} */
export function fixtureDepartment(overrides = {}) {
  return normalizePersonalRecord('departments', { id: 'DEP-1', name: 'Educatori', order: 0, ...overrides });
}

/** @param {Partial<Role>} [overrides] @returns {Role} */
export function fixtureRole(overrides = {}) {
  return normalizePersonalRecord('roles', {
    id: 'ROL-1',
    name: 'Educator',
    departmentId: 'DEP-1',
    order: 0,
    ...overrides,
  });
}

/** @param {Partial<Staff>} [overrides] @returns {Staff} */
export function fixtureStaff(overrides = {}) {
  return normalizePersonalRecord('staff', {
    id: 'STF-1',
    name: 'Ana Popescu',
    roleId: 'ROL-1',
    branchIds: ['bu'],
    since: '2026-01-01',
    ...overrides,
  });
}

/** @param {Partial<Leave>} [overrides] @returns {Leave} */
export function fixtureLeave(overrides = {}) {
  return normalizePersonalRecord('leaves', {
    id: 'LV-1',
    staffId: 'STF-1',
    from: '2026-07-06',
    to: '2026-07-17',
    type: 'CO',
    planned: false,
    ...overrides,
  });
}
