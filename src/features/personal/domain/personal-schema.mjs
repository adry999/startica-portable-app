import { requireThat, requireAmount } from '#shared/domain/record-schema.mjs';
import { dateOK, monthOK } from '#shared/domain/calendar-month.mjs';
import { resolveStoredPhone } from '#shared/domain/phone-number.mjs';

// Personal 24 (docs/superpowers/plans/2026-09-27-personal-bazin.md, decizia 2): kind-uri JSON în
// baza comună, prin createKindRepository — niciodată prin TYPES/normalizeRecord.
export const PERSONAL_KINDS = [
  'departments',
  'roles',
  'staff',
  'timesheet',
  'leaves',
  'salaries',
  'advances',
  'salary_payments',
  'candidates',
];

const ID_PREFIXES = {
  departments: 'DEP-',
  roles: 'ROL-',
  staff: 'STF-',
  timesheet: 'TS-',
  leaves: 'LV-',
  salaries: 'SAL-',
  advances: 'ADV-',
  salary_payments: 'SP-',
  candidates: 'CAN-',
};

export const TIMESHEET_CODES = ['CO', 'CM', 'A', 'I', 'FP'];
export const LEAVE_TYPES = ['CO', 'CM', 'FP'];
export const SALARY_MODES = ['fix', 'zi', 'bazin'];

// Ciclul din 23b (decizia 12): clic pe celulă merge gol → CO → CM → A → gol.
// I și FP nu sunt în ciclu — vin doar din formularul de concediu, respectiv rămân
// fără UI în V1 (întrebarea 3): un clic pe o astfel de celulă o golește.
const CLICK_CYCLE = ['', 'CO', 'CM', 'A'];

/**
 * @param {'' | null | import('../personal.types.d.mts').TimesheetCode} code
 * @returns {import('../personal.types.d.mts').TimesheetCode | null}
 */
export function nextTimesheetCode(code) {
  const normalized = code || '';
  const index = CLICK_CYCLE.indexOf(normalized);
  const nextIndex = index === -1 ? 0 : (index + 1) % CLICK_CYCLE.length;
  return /** @type {any} */ (CLICK_CYCLE[nextIndex] || null);
}

/**
 * @param {{ branchIds: string[] }} staff
 * @param {string} branchId
 */
export function isStaffInBranch(staff, branchId) {
  return staff.branchIds.includes(branchId);
}

/**
 * „ambele filiale” (decizia 17 din spec) — angajatul lucrează la toate filialele existente.
 * @param {{ branchIds: string[] }} staff
 * @param {string[]} branchIds toate filialele existente (registrul)
 */
export function worksAtAllBranches(staff, branchIds) {
  return branchIds.length > 1 && branchIds.every(branchId => staff.branchIds.includes(branchId));
}

function text(value, field, required = false) {
  requireThat(
    typeof value === 'string' && value.length <= 10000 && (!required || value.trim()),
    `${field}: text invalid sau lipsă.`,
  );
}

/** @param {string} id @param {string} kind */
function requireValidId(id, kind) {
  const prefix = ID_PREFIXES[kind];
  requireThat(
    typeof id === 'string' && id.startsWith(prefix) && /^[A-Za-z0-9_-]{1,100}$/.test(id),
    `ID invalid pentru ${kind}: trebuie să înceapă cu „${prefix}”.`,
  );
}

// §10 (02.10) — la fel ca în record-schema.mjs: un mobil moldovenesc valid devine E.164, un
// „alt număr” cu „+” rămâne cum a fost scris, orice altceva rămâne cum a fost scris dar marcat
// `phoneInvalid` (bannerul „de verificat”, nu construit aici, îl va găsi după asta).
function applyPhoneField(record) {
  const resolved = resolveStoredPhone(record.phone);
  record.phone = resolved.value;
  if (resolved.invalid) record.phoneInvalid = true;
  else delete record.phoneInvalid;
}

const FIELDS = {
  departments: new Set(['id', 'name', 'order']),
  roles: new Set(['id', 'name', 'departmentId', 'order']),
  staff: new Set([
    'id',
    'name',
    'roleId',
    'branchIds',
    'phone',
    'phoneInvalid',
    'birth',
    'idnp',
    'address',
    'since',
    'archivedAt',
    'notes',
  ]),
  timesheet: new Set(['id', 'staffId', 'date', 'code', 'leaveId']),
  leaves: new Set(['id', 'staffId', 'from', 'to', 'type', 'planned', 'note']),
  salaries: new Set(['id', 'staffId', 'mode', 'amount', 'validFrom']),
  advances: new Set(['id', 'staffId', 'date', 'amount', 'method', 'month', 'deductedAt', 'deductedBy', 'expenseId']),
  salary_payments: new Set(['id', 'staffId', 'month', 'branchId', 'mode', 'amount', 'advances', 'expenseId', 'paidAt']),
  candidates: new Set([
    'id',
    'name',
    'position',
    'age',
    'experience',
    'city',
    'phone',
    'phoneInvalid',
    'notes',
    'createdAt',
    'updatedAt',
  ]),
};

/** @param {string} kind */
export function normalizePersonalRecord(kind, input) {
  requireThat(
    PERSONAL_KINDS.includes(kind) && !!input && typeof input === 'object' && !Array.isArray(input),
    'Înregistrare invalidă.',
  );
  const record = structuredClone(input);
  for (const key of Object.keys(record)) if (!FIELDS[kind].has(key)) delete record[key];
  requireValidId(record.id, kind);

  if (kind === 'departments' || kind === 'roles') {
    text(record.name, 'Nume', true);
    record.name = record.name.trim();
    record.order ??= 0;
    requireThat(Number.isInteger(record.order) && record.order >= 0, 'Ordinea este invalidă.');
    if (kind === 'roles') text(record.departmentId, 'Departament', true);
    return record;
  }

  if (kind === 'staff') {
    text(record.name, 'Nume angajat', true);
    record.name = record.name.trim();
    text(record.roleId, 'Funcție', true);
    requireThat(
      Array.isArray(record.branchIds) &&
        record.branchIds.length > 0 &&
        record.branchIds.every(id => typeof id === 'string'),
      'Angajatul trebuie să aibă cel puțin o filială.',
    );
    record.phone ??= '';
    text(record.phone, 'Telefon');
    applyPhoneField(record);
    record.birth ??= '';
    text(record.birth, 'Data nașterii');
    if (record.birth) requireThat(dateOK(record.birth), 'Data nașterii este invalidă.');
    record.idnp ??= '';
    text(record.idnp, 'IDNP');
    record.address ??= '';
    text(record.address, 'Adresa');
    record.notes ??= [];
    requireThat(Array.isArray(record.notes) && record.notes.length <= 1000, 'Notele sunt invalide.');
    for (const note of record.notes) {
      requireThat(
        note && typeof note.at === 'string' && !Number.isNaN(Date.parse(note.at)) && typeof note.text === 'string',
        'O notă este invalidă.',
      );
    }
    requireThat(dateOK(record.since), 'Data angajării este invalidă.');
    if (record.archivedAt) requireThat(dateOK(record.archivedAt), 'Data încetării este invalidă.');
    else record.archivedAt ??= null;
    return record;
  }

  if (kind === 'timesheet') {
    text(record.staffId, 'Angajat', true);
    requireThat(dateOK(record.date), 'Zi invalidă.');
    requireThat(TIMESHEET_CODES.includes(record.code), `Cod invalid: folosește ${TIMESHEET_CODES.join(', ')}.`);
    if (record.leaveId !== undefined) text(record.leaveId, 'Concediu');
    return record;
  }

  if (kind === 'leaves') {
    text(record.staffId, 'Angajat', true);
    requireThat(dateOK(record.from) && dateOK(record.to) && record.from <= record.to, 'Perioada este invalidă.');
    requireThat(LEAVE_TYPES.includes(record.type), `Tip concediu invalid: folosește ${LEAVE_TYPES.join(', ')}.`);
    requireThat(typeof record.planned === 'boolean', 'Planificarea este invalidă.');
    if (record.note !== undefined) text(record.note, 'Notă');
    return record;
  }

  if (kind === 'salaries') {
    text(record.staffId, 'Angajat', true);
    requireThat(SALARY_MODES.includes(record.mode), `Mod de salarizare invalid: folosește ${SALARY_MODES.join(', ')}.`);
    requireAmount(record.amount, 'Salariul', true);
    requireThat(monthOK(record.validFrom), 'Lună invalidă.');
    return record;
  }

  if (kind === 'advances') {
    text(record.staffId, 'Angajat', true);
    requireThat(dateOK(record.date), 'Data avansului este invalidă.');
    requireAmount(record.amount, 'Avansul');
    text(record.method, 'Metoda', true);
    requireThat(monthOK(record.month), 'Lună invalidă.');
    if (record.deductedAt) requireThat(dateOK(record.deductedAt), 'Data scăderii este invalidă.');
    else record.deductedAt ??= null;
    record.deductedBy ??= null;
    if (record.deductedBy !== null) text(record.deductedBy, 'Plata care a scăzut avansul');
    text(record.expenseId, 'Cheltuiala avansului', true);
    return record;
  }

  if (kind === 'candidates') {
    text(record.name, 'Nume, prenume', true);
    record.name = record.name.trim();
    record.position ??= '';
    text(record.position, 'Poziție');
    if (record.age !== undefined && record.age !== null && record.age !== '') {
      requireThat(Number.isInteger(record.age) && record.age >= 0 && record.age <= 120, 'Vârsta este invalidă.');
    } else {
      record.age = null;
    }
    record.experience ??= '';
    text(record.experience, 'Experiență');
    record.city ??= '';
    text(record.city, 'Unde locuiește');
    record.phone ??= '';
    text(record.phone, 'Telefon');
    applyPhoneField(record);
    record.notes ??= '';
    text(record.notes, 'Notițe');
    requireThat(
      typeof record.createdAt === 'string' && !Number.isNaN(Date.parse(record.createdAt)),
      'Data creării este invalidă.',
    );
    requireThat(
      typeof record.updatedAt === 'string' && !Number.isNaN(Date.parse(record.updatedAt)),
      'Data actualizării este invalidă.',
    );
    return record;
  }

  // salary_payments
  text(record.staffId, 'Angajat', true);
  requireThat(monthOK(record.month), 'Lună invalidă.');
  text(record.branchId, 'Filiala', true);
  requireThat(SALARY_MODES.includes(record.mode), `Mod de salarizare invalid: folosește ${SALARY_MODES.join(', ')}.`);
  requireAmount(record.amount, 'Salariul', true);
  record.advances ??= [];
  requireThat(
    Array.isArray(record.advances) && record.advances.every(id => typeof id === 'string'),
    'Lista de avansuri este invalidă.',
  );
  text(record.expenseId, 'Cheltuiala plății', true);
  requireThat(
    typeof record.paidAt === 'string' && !Number.isNaN(Date.parse(record.paidAt)),
    'Data plății este invalidă.',
  );
  return record;
}
