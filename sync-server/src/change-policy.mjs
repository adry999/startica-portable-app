// Copie a constantelor din #shared/domain/record-schema.mjs — sync-server/ nu importă nimic
// din src/ (decizia 1 din plan). Egalitatea cu originalul e verificată de testul de la
// rădăcina depozitului, tests/sync-shared-constants.test.mjs.
export const RECORD_KINDS = [
  'children',
  'payments',
  'expenses',
  'groups',
  'categories',
  'visits',
  'charges',
  'payerAliases',
  'services',
];
export const SENSITIVE_FIELDS = { visits: ['healthNotes'], children: ['healthNotes'] };

// Copie a paletei din #shared/domain/branch.mjs (D-1 din audit): aplicația trimite unul
// din aceste nume, nu un cod hex — serverul respingea orice culoare reală înainte de fix.
export const BRANCH_COLORS = ['orange', 'mint', 'yellow', 'pink'];

// Setul comun (Personal 24, decizia 1/9, 2026-09-27-personal-bazin.md): un dataset cu id fix,
// nu o filială — branches.routes.mjs/changes.routes.mjs îl acceptă fără o înregistrare în
// branches.json, GET /v1/branches nu-l listează niciodată (nimeni nu-l înregistrează).
export const COMMON_DATASET_ID = 'comun';

// Kind-urile setului comun — „Changes to the sync plan”: toate LWW în afară de `staff`
// (conflict — e o fișă). Trăiesc în tabela records a bazei Comun\, prin createKindRepository,
// niciodată prin TYPES/normalizeRecord (decizia 2).
export const COMMON_KINDS = [
  'staff',
  'departments',
  'roles',
  'timesheet',
  'leaves',
  'salaries',
  'advances',
  'salary_payments',
  // S-4: candidates la angajare — nu era în listă, deci nu se contopea între calculatoare
  // și un 410 îl ștergea (change-applier.mjs COMMON_KINDS controla ce supraviețuia). LWW ca
  // majoritatea siblings de mai sus, nu CONFLICT_KIND ca `staff` (docs/design/screens/
  // 24-personal.md: „sincronizat ca restul”).
  'candidates',
];

// Tipurile sincronizate în total: fișele (RECORD_KINDS) + prezența + tabelele proprii ale
// Bazinului (decizia 11, 2026-09-27-personal-bazin.md — ca attendance, LWW) + setul comun
// (COMMON_KINDS) + șabloanele SMS + setările sincronizate (Faza 6 le tratează efectiv; aici
// numele de tip e deja rezervat).
export const KINDS = [
  ...RECORD_KINDS,
  'attendance',
  'pool_bookings',
  'pool_sessions',
  'pool_closings',
  ...COMMON_KINDS,
  'sms_templates',
  'settings',
];

// Fișele și grupele nu se pierd niciodată în tăcere: o revizie depășită devine conflict,
// rezolvat de utilizator (14c). `staff` e tot o fișă (decizia „Changes to the sync plan”).
// Restul tipurilor sunt last-writer-wins (decizia 5).
export const CONFLICT_KINDS = ['children', 'groups', 'categories', 'visits', 'staff'];

/** @param {string} kind */
export function isLastWriterWins(kind) {
  return !CONFLICT_KINDS.includes(kind);
}
