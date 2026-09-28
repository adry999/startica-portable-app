// Copie a constantelor din #shared/domain/record-schema.mjs — sync-server/ nu importă nimic
// din src/ (decizia 1 din plan). Egalitatea cu originalul e verificată de testul de la
// rădăcina depozitului, tests/sync-shared-constants.test.mjs.
export const RECORD_KINDS = ['children', 'payments', 'expenses', 'groups', 'categories', 'visits', 'charges'];
export const SENSITIVE_FIELDS = { visits: ['healthNotes'], children: ['healthNotes'] };

// Copie a paletei din #shared/domain/branch.mjs (D-1 din audit): aplicația trimite unul
// din aceste nume, nu un cod hex — serverul respingea orice culoare reală înainte de fix.
export const BRANCH_COLORS = ['orange', 'mint', 'yellow', 'pink'];

// Tipurile sincronizate în total: fișele (RECORD_KINDS) + prezența + tabelele proprii ale
// Bazinului (decizia 11, 2026-09-27-personal-bazin.md — ca attendance, LWW) + șabloanele SMS +
// setările sincronizate (Faza 6 le tratează efectiv; aici numele de tip e deja rezervat).
export const KINDS = [
  ...RECORD_KINDS,
  'attendance',
  'pool_bookings',
  'pool_sessions',
  'pool_closings',
  'sms_templates',
  'settings',
];

// Fișele și grupele nu se pierd niciodată în tăcere: o revizie depășită devine conflict,
// rezolvat de utilizator (14c). Restul tipurilor sunt last-writer-wins (decizia 5).
export const CONFLICT_KINDS = ['children', 'groups', 'categories', 'visits'];

/** @param {string} kind */
export function isLastWriterWins(kind) {
  return !CONFLICT_KINDS.includes(kind);
}
