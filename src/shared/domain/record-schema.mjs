import { monthOK, dateOK } from './calendar-month.mjs';
import { cents } from './money.mjs';

export const TYPES = ['children', 'payments', 'expenses', 'groups', 'categories'];
// Stări reale, folosite de obligation() și acceptate în statusHistory.
export const STATUS_HISTORY_VALUES = ['Activ', 'Suspendat', 'Retras'];
// Statutul unei fișe. „De verificat” marchează o fișă importată a cărei
// situație nu este confirmată; nu este o stare din care se pot calcula
// obligații, deci nu apare în statusHistory.
export const CHILD_STATUSES = [...STATUS_HISTORY_VALUES, 'De verificat'];
/** @type {() => { children: any[], payments: any[], expenses: any[], groups: any[], categories: any[] }} */
export const emptyState = () => ({ children: [], payments: [], expenses: [], groups: [], categories: [] });
export function requireThat(ok, message) {
  if (!ok) throw new Error(message);
}
function text(v, field, required = false) {
  requireThat(
    typeof v === 'string' && v.length <= 10000 && (!required || v.trim()),
    `${field}: text invalid sau lipsă.`,
  );
}
export function requireAmount(v, field, zero = false) {
  requireThat(
    typeof v === 'number' &&
      Number.isFinite(v) &&
      (zero ? v >= 0 : v > 0) &&
      v <= 100000000 &&
      Math.abs(v * 100 - Math.round(v * 100)) < 0.00001,
    `${field}: folosește o sumă validă, cu cel mult doi zecimali.`,
  );
}
// Câmpurile pe care le poate avea o înregistrare, per tip. Orice altceva se
// elimină la normalizare: până acum, un câmp trimis o singură dată rămânea în
// bază pentru totdeauna, intra în exportul Excel și apărea în jurnalul de
// modificări, fără ca nimic să îl explice. Lista este și documentația modelului.
const FIELDS = {
  children: new Set([
    'id',
    'name',
    'contractNumber',
    'parent',
    'phone',
    'parent2',
    'phone2',
    'birthDate',
    'contractDate',
    'attendanceDate',
    'withdrawalDate',
    'groupId',
    'status',
    'statusHistory',
    'fee',
    'feeHistory',
    'dueDay',
    'notes',
    'verification',
    'archived',
    'archivedAt',
  ]),
  payments: new Set([
    'id',
    'date',
    'childId',
    'childName',
    'sourceName',
    // Pus de importul V5 când plata trimite la un copil care nu există în
    // fișier; păstrează proveniența pentru asocierea manuală de mai târziu.
    'sourceChildId',
    'group',
    'month',
    'method',
    'tenders',
    'amount',
    'allocations',
    'type',
    'notes',
    'verification',
    'original',
    'reviewed',
    'importSource',
    'archived',
    'archivedAt',
  ]),
  expenses: new Set([
    'id',
    'date',
    'category',
    'description',
    'amount',
    'notes',
    'importSource',
    'archived',
    'archivedAt',
  ]),
  groups: new Set(['id', 'name', 'capacity', 'educator']),
  categories: new Set(['id', 'name']),
};
export function normalizeRecord(type, input) {
  requireThat(
    TYPES.includes(type) && input && typeof input === 'object' && !Array.isArray(input),
    'Înregistrare invalidă.',
  );
  const record = structuredClone(input);
  for (const key of Object.keys(record)) if (!FIELDS[type].has(key)) delete record[key];
  requireThat(typeof record.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(record.id), 'ID invalid.');
  if (record.archived !== undefined) requireThat(typeof record.archived === 'boolean', 'Arhivare invalidă.');
  for (const field of [
    'notes',
    'verification',
    'original',
    'sourceName',
    'childName',
    'description',
    'parent',
    'phone',
    'parent2',
    'phone2',
    'group',
    'category',
    'method',
  ])
    if (record[field] !== undefined) text(record[field], field);
  if (type === 'children') {
    text(record.name, 'Nume copil', true);
    record.name = record.name.trim();
    record.status ||= 'Activ';
    text(record.status, 'Statut', true);
    requireThat(CHILD_STATUSES.includes(record.status), `Statut: folosește ${CHILD_STATUSES.join(', ')}.`);
    record.groupId ??= null;
    if (record.groupId !== null)
      requireThat(
        typeof record.groupId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(record.groupId),
        'Grupă invalidă.',
      );
    record.parent ??= '';
    record.phone ??= '';
    record.fee ??= null;
    if (record.fee !== null) requireAmount(record.fee, 'Taxa', true);
    record.dueDay ??= 10;
    requireThat(
      Number.isInteger(record.dueDay) && record.dueDay >= 1 && record.dueDay <= 31,
      'Scadența trebuie să fie între 1 și 31.',
    );
    for (const field of ['birthDate', 'contractDate', 'attendanceDate', 'withdrawalDate'])
      if (record[field]) requireThat(dateOK(record[field]), `${field}: dată invalidă.`);
    if (record.attendanceDate && record.withdrawalDate)
      requireThat(
        record.withdrawalDate >= record.attendanceDate,
        'Retragerea nu poate preceda începerea frecventării.',
      );
    for (const [field, valueKey] of [
      ['feeHistory', 'amount'],
      ['statusHistory', 'status'],
    ]) {
      record[field] ??= [];
      requireThat(Array.isArray(record[field]) && record[field].length <= 1000, `${field}: istoric invalid.`);
      const seen = new Set();
      for (const historyEntry of record[field]) {
        requireThat(
          historyEntry && monthOK(historyEntry.from) && !seen.has(historyEntry.from),
          `${field}: lună invalidă sau repetată.`,
        );
        seen.add(historyEntry.from);
        if (valueKey === 'amount') requireAmount(historyEntry.amount, 'Taxa istorică', true);
        else requireThat(STATUS_HISTORY_VALUES.includes(historyEntry.status), 'Statut istoric invalid.');
      }
      record[field].sort((a, b) => a.from.localeCompare(b.from));
    }
  } else if (type === 'groups') {
    text(record.name, 'Nume grupă', true);
    record.name = record.name.trim();
    if (record.capacity !== undefined && record.capacity !== null) {
      requireThat(
        Number.isInteger(record.capacity) && record.capacity >= 1 && record.capacity <= 1000,
        'Capacitatea trebuie să fie un număr întreg între 1 și 1000.',
      );
    } else record.capacity = null;
  } else if (type === 'categories') {
    text(record.name, 'Nume categorie', true);
    record.name = record.name.trim();
  } else {
    requireThat(dateOK(record.date), 'Data operațiunii este invalidă.');
    if (type === 'payments' && record.tenders !== undefined) {
      requireThat(
        Array.isArray(record.tenders) && record.tenders.length > 0 && record.tenders.length <= 10,
        'Completează cel puțin o sumă Cash, Card sau Transfer.',
      );
      const methods = new Set();
      let sum = 0;
      for (const part of record.tenders) {
        requireThat(part && typeof part === 'object', 'Componentă de achitare invalidă.');
        text(part.method, 'Metoda de achitare', true);
        part.method = part.method.trim();
        requireThat(!methods.has(part.method.toLowerCase()), 'Metodă de achitare repetată.');
        methods.add(part.method.toLowerCase());
        requireAmount(part.amount, 'Suma ' + part.method);
        sum += cents(part.amount);
      }
      if (record.amount !== undefined) {
        requireAmount(record.amount, 'Suma');
        requireThat(cents(record.amount) === sum, 'Totalul trebuie să fie egal cu suma Cash + Card + Transfer.');
      }
      record.amount = sum / 100;
      record.method = record.tenders.map(tender => tender.method).join(' + ');
    }
    requireAmount(record.amount, 'Suma');
    if (type === 'payments') {
      record.childId ??= '';
      text(record.childId, 'ID copil');
      record.method ||= 'Cash';
      record.allocations ??= record.month ? [{ month: record.month, amount: record.amount }] : [];
      requireThat(Array.isArray(record.allocations) && record.allocations.length <= 120, 'Repartizare invalidă.');
      const seen = new Set();
      let allocated = 0;
      for (const allocation of record.allocations) {
        requireThat(
          allocation && monthOK(allocation.month) && !seen.has(allocation.month),
          'Lună de repartizare invalidă sau repetată.',
        );
        seen.add(allocation.month);
        requireAmount(allocation.amount, 'Suma repartizată');
        allocated += cents(allocation.amount);
      }
      requireThat(allocated <= cents(record.amount), 'Repartizările depășesc suma plății.');
      record.month = record.allocations.length === 1 ? record.allocations[0].month : '';
    } else {
      record.category ||= 'Altele';
      record.description ??= '';
    }
  }
  return record;
}
export function validateState(input) {
  const state = emptyState();
  for (const type of TYPES) {
    requireThat(Array.isArray(input?.[type]) && input[type].length <= 100000, `Lista ${type} este invalidă.`);
    const seen = new Set();
    state[type] = input[type].map(rawRecord => {
      const normalized = normalizeRecord(type, rawRecord);
      requireThat(!seen.has(normalized.id), `ID repetat: ${normalized.id}`);
      seen.add(normalized.id);
      return normalized;
    });
  }
  const ids = new Set(state.children.map(child => child.id));
  for (const payment of state.payments)
    requireThat(
      !payment.childId || ids.has(payment.childId),
      `Plata ${payment.id}: copilul ${payment.childId} nu există.`,
    );
  const groupIds = new Set(state.groups.map(group => group.id));
  for (const child of state.children)
    requireThat(
      !child.groupId || groupIds.has(child.groupId),
      `Copilul ${child.id}: grupa ${child.groupId} nu există.`,
    );
  return state;
}
