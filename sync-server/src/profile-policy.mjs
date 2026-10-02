// Copie a `#shared/domain/computer-profile.mjs` — sync-server/ nu importă nimic din src/
// (decizia 1 din planul de sincronizare). Egalitatea cu originalul (module, preseturi, hartă
// tip→modul) e verificată de testul de la rădăcina depozitului, tests/sync-shared-constants.test.mjs.

export const MODULE_IDS = [
  'dashboard',
  'children',
  'groups',
  'attendance',
  'visits',
  'personal',
  'pool',
  'payments',
  'expenses',
  'status',
  'notify',
  'report',
  'resolve',
  'admin',
];

export const ADMIN_ONLY_MODULES = ['admin'];

export const ACCESS_NONE = 0;
export const ACCESS_READ = 1;
export const ACCESS_WRITE = 2;
export const ACCESS_LEVELS = [ACCESS_NONE, ACCESS_READ, ACCESS_WRITE];

export const PRESET_IDS = ['complet', 'educator', 'receptie', 'bazin', 'personalizat'];

/** @param {number} level @returns {Record<string, number>} */
function allModules(level) {
  return Object.fromEntries(MODULE_IDS.map(moduleId => [moduleId, level]));
}

/** @param {Record<string, number>} overrides @returns {Record<string, number>} */
function modulesWith(overrides) {
  return /** @type {Record<string, number>} */ ({ ...allModules(ACCESS_NONE), ...overrides });
}

const PRESET_MODULES = {
  complet: allModules(ACCESS_WRITE),
  educator: modulesWith({ attendance: ACCESS_WRITE, children: ACCESS_READ, groups: ACCESS_READ }),
  receptie: modulesWith({
    visits: ACCESS_WRITE,
    attendance: ACCESS_WRITE,
    children: ACCESS_READ,
    groups: ACCESS_READ,
  }),
  bazin: modulesWith({ pool: ACCESS_WRITE, children: ACCESS_READ }),
};

/** @returns {{ preset: string, modules: Record<string, number>, pinModules: string[], blocked: boolean }} */
export function completProfile() {
  return { preset: 'complet', modules: allModules(ACCESS_WRITE), pinModules: [], blocked: false };
}

/** @param {string} preset @returns {Record<string, number>} */
export function presetModules(preset) {
  if (preset === 'personalizat') return allModules(ACCESS_NONE);
  return PRESET_MODULES[preset] ? { ...PRESET_MODULES[preset] } : allModules(ACCESS_NONE);
}

/**
 * @param {string} preset
 * @param {Record<string, number>} modules
 */
export function clampModules(preset, modules) {
  const clamped = { ...modules };
  if (preset !== 'complet') for (const moduleId of ADMIN_ONLY_MODULES) clamped[moduleId] = ACCESS_NONE;
  for (const moduleId of MODULE_IDS)
    clamped[moduleId] = ACCESS_LEVELS.includes(clamped[moduleId]) ? clamped[moduleId] : ACCESS_NONE;
  return clamped;
}

/**
 * @param {{ preset?: string, modules?: Record<string, number>, pinModules?: string[], blocked?: boolean }} input
 */
export function normalizeProfile(input) {
  const preset = PRESET_IDS.includes(input?.preset ?? '') ? /** @type {string} */ (input.preset) : 'personalizat';
  const baseModules = preset === 'personalizat' ? (input?.modules ?? allModules(ACCESS_NONE)) : presetModules(preset);
  const pinModules = (input?.pinModules ?? []).filter(moduleId => MODULE_IDS.includes(moduleId));
  return {
    preset,
    modules: clampModules(preset, baseModules),
    pinModules: [...new Set(pinModules)],
    blocked: !!input?.blocked,
  };
}

/**
 * @param {{ modules: Record<string, number>, blocked: boolean } | null | undefined} profile
 * @param {string} moduleId
 * @param {number} [level]
 */
export function isModuleAllowed(profile, moduleId, level = ACCESS_READ) {
  const resolved = profile ?? completProfile();
  if (resolved.blocked) return false;
  return (resolved.modules[moduleId] ?? ACCESS_NONE) >= level;
}

/** Harta tip sincronizat → modulul care îi guvernează accesul pe server (vezi `KINDS` în change-policy.mjs). */
export const KIND_MODULE = {
  children: 'children',
  groups: 'groups',
  categories: 'expenses',
  visits: 'visits',
  charges: 'payments',
  payerAliases: 'payments',
  services: 'payments',
  payments: 'payments',
  expenses: 'expenses',
  attendance: 'attendance',
  pool_bookings: 'pool',
  pool_sessions: 'pool',
  pool_closings: 'pool',
  staff: 'personal',
  departments: 'personal',
  roles: 'personal',
  timesheet: 'personal',
  leaves: 'personal',
  salaries: 'personal',
  advances: 'personal',
  salary_payments: 'personal',
  candidates: 'personal',
  sms_templates: 'admin',
  settings: 'admin',
};

/** Câmpuri tăiate din `children` când modulul `payments` e la 0 (36e — „plățile, planul tarifar
 * și notele medicale nu sunt pe acest calculator”). Nu există azi un câmp `allergies` separat în
 * schema reală — doar `healthNotes` (vezi SENSITIVE_FIELDS din change-policy.mjs) — vezi INTREBARI.md. */
export const CHILDREN_FIELDS_HIDDEN_WITHOUT_PAYMENTS = ['healthNotes', 'feeHistory'];

export const AUDIT_LOG_KIND = 'audit_log';
