// Profilul de calculator (§5.3, docs/design/screens/31-profiluri-calculator.md): reguli pure,
// izomorfe (server + webapp), reutilizate pe ambele capete ale sincronizării. `sync-server/` nu
// importă din `src/` (decizia 1 din planul de sincronizare) — `MODULE_IDS`/`PRESETS`/`KIND_MODULE`
// au o copie în `sync-server/src/profile-policy.mjs`, verificată de `tests/sync-shared-constants.test.mjs`.

/**
 * Modulele canonice (36b): fiecare are un acces 0/1/2. `admin` e mereu doar Complet — nici
 * profilul Personalizat nu-l poate ridica (vezi `clampModules`). Interpretare (INTREBARI.md):
 * rândul „Mesaje SMS” din artboard nu are rută proprie în cod, eliminat; `resolve` grupează
 * Taxe + De verificat + Asociere achitări + Conflicte de sincronizare (toate „De rezolvat”).
 */
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

/** Module la care nicio altă valoare decât Complet nu poate ridica accesul peste 0. */
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

/** Modulele fiecărui preset fix (36a, P din artboard) — `personalizat` nu are modulele fixe, vin din profilul salvat. */
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

/** Module cu PIN implicit la Personalizat nou (36b) — mereu disponibile de modificat ulterior. */
export const DEFAULT_PIN_MODULES = ['payments', 'expenses', 'report', 'resolve'];

/** @typedef {{ preset: string, modules: Record<string, number>, pinModules: string[], blocked: boolean }} ComputerProfile */

/** Profilul implicit pentru un calculator fără profil asignat (compatibilitate — vezi INTREBARI.md). */
export function completProfile() {
  return { preset: 'complet', modules: allModules(ACCESS_WRITE), pinModules: [], blocked: false };
}

/** @param {string} preset @returns {Record<string, number>} */
export function presetModules(preset) {
  if (preset === 'personalizat') return allModules(ACCESS_NONE);
  return PRESET_MODULES[preset] ? { ...PRESET_MODULES[preset] } : allModules(ACCESS_NONE);
}

/**
 * Forțează modulele mereu-Complet la 0 pentru orice alt preset (server și client trebuie să
 * aplice aceeași regulă — „Administrare, Salarii și Sincronizare rămân doar Complet”, 36b).
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
 * @returns {ComputerProfile}
 */
export function normalizeProfile(input) {
  const preset = PRESET_IDS.includes(input?.preset ?? '') ? /** @type {string} */ (input.preset) : 'personalizat';
  const baseModules = preset === 'personalizat' ? (input?.modules ?? allModules(ACCESS_NONE)) : presetModules(preset);
  const pinModules =
    preset === 'personalizat'
      ? (input?.pinModules ?? []).filter(moduleId => MODULE_IDS.includes(moduleId))
      : (input?.pinModules ?? []).filter(moduleId => MODULE_IDS.includes(moduleId));
  return {
    preset,
    modules: clampModules(preset, baseModules),
    pinModules: [...new Set(pinModules)],
    blocked: !!input?.blocked,
  };
}

/**
 * @param {ComputerProfile | null | undefined} profile `null`/`undefined` = calculator fără profil
 *   asignat (compatibilitate — tratat ca profil Complet, vezi `completProfile`).
 * @param {string} moduleId
 * @param {number} [level] Nivelul minim cerut (implicit 1, „Vede”).
 */
export function isModuleAllowed(profile, moduleId, level = ACCESS_READ) {
  const resolved = profile ?? completProfile();
  if (resolved.blocked) return false;
  return (resolved.modules[moduleId] ?? ACCESS_NONE) >= level;
}

/** @param {ComputerProfile | null | undefined} profile */
export function requiresPin(profile, moduleId) {
  const resolved = profile ?? completProfile();
  return !resolved.blocked && resolved.pinModules.includes(moduleId);
}

/**
 * Primul modul permis cu cel puțin acces de citire, pentru butonul „Mergi la…” din 36f și
 * pentru redirecționarea de pe `/` pe profilurile fără Dashboard (43a/43b — în pauză, vezi
 * INTREBARI.md; aici doar funcția pură de alegere a primului modul).
 * @param {ComputerProfile | null | undefined} profile
 * @param {string[]} [order] Ordinea de preferință (implicit ordinea canonică).
 */
export function firstAllowedModule(profile, order = MODULE_IDS) {
  return order.find(moduleId => moduleId !== 'admin' && isModuleAllowed(profile, moduleId)) ?? null;
}

/**
 * Harta tip de înregistrare (local, `#shared/domain/record-schema.mjs` TYPES + restul
 * tipurilor sincronizate) → modulul care îi guvernează accesul. Folosită de gărzile `/api`
 * dinamice (`/api/record`, `/api/record-delete`, `/api/undo`) și, pe server, pentru filtrarea
 * de sincronizare (copia din `sync-server/src/profile-policy.mjs`).
 */
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

/**
 * `audit_log` nu e guvernat de `admin` ca restul tipurilor din `KIND_MODULE`: fiecare
 * calculator trebuie să-și poată trimite propriile intrări (altfel istoricul central n-ar
 * avea ce arăta pentru un calculator restrâns), dar numai un profil Complet le primește
 * înapoi la sincronizare (36g). Tratat separat în `changes.service.mjs`, nu prin modul.
 */
export const AUDIT_LOG_KIND = 'audit_log';
