import type { ViewKey } from './nav-items';

/**
 * Modulul de profil (§5.3, `computer-profile.mjs`) care guvernează fiecare ecran din `nav-items.ts`.
 * Sursa unică pentru `ModuleGuard`, filtrarea meniului (Sidebar) și testul de arhitectură
 * (`architecture.test.ts`, R12) — „Taxe și grupe”/„De verificat”/„Asociere achitări”/„Conflicte”
 * se adună sub `resolve` (interpretare deja aplicată server-side, vezi INTREBARI.md §5.3), iar
 * „Istoric”/„Notificări”/„Backup și setări” sub `admin`, exact ca în `route-modules.mjs`.
 */
export const VIEW_MODULE: Record<ViewKey, string> = {
  dashboard: 'dashboard',
  children: 'children',
  groups: 'groups',
  attendance: 'attendance',
  pool: 'pool',
  visits: 'visits',
  personal: 'personal',
  payments: 'payments',
  expenses: 'expenses',
  status: 'status',
  notify: 'notify',
  report: 'report',
  fees: 'resolve',
  review: 'resolve',
  assign: 'resolve',
  conflicts: 'resolve',
  audit: 'admin',
  notifications: 'admin',
  settings: 'admin',
};

/** Ecranul implicit al fiecărui modul, pentru butonul „Mergi la …” din `profil.blocked` (36f) —
 * primul ecran din `nav-items.ts` care ține de acel modul, în ordinea canonică a meniului. */
export const MODULE_FIRST_VIEW: Record<string, ViewKey> = {
  dashboard: 'dashboard',
  children: 'children',
  groups: 'groups',
  attendance: 'attendance',
  visits: 'visits',
  personal: 'personal',
  pool: 'pool',
  payments: 'payments',
  expenses: 'expenses',
  status: 'status',
  notify: 'notify',
  report: 'report',
  resolve: 'fees',
  admin: 'audit',
};
