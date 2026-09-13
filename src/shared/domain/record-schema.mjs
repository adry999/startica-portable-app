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
  const r = structuredClone(input);
  for (const key of Object.keys(r)) if (!FIELDS[type].has(key)) delete r[key];
  requireThat(typeof r.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(r.id), 'ID invalid.');
  if (r.archived !== undefined) requireThat(typeof r.archived === 'boolean', 'Arhivare invalidă.');
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
    if (r[field] !== undefined) text(r[field], field);
  if (type === 'children') {
    text(r.name, 'Nume copil', true);
    r.name = r.name.trim();
    r.status ||= 'Activ';
    text(r.status, 'Statut', true);
    requireThat(CHILD_STATUSES.includes(r.status), `Statut: folosește ${CHILD_STATUSES.join(', ')}.`);
    r.groupId ??= null;
    if (r.groupId !== null)
      requireThat(typeof r.groupId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(r.groupId), 'Grupă invalidă.');
    r.parent ??= '';
    r.phone ??= '';
    r.fee ??= null;
    if (r.fee !== null) requireAmount(r.fee, 'Taxa', true);
    r.dueDay ??= 10;
    requireThat(
      Number.isInteger(r.dueDay) && r.dueDay >= 1 && r.dueDay <= 31,
      'Scadența trebuie să fie între 1 și 31.',
    );
    for (const field of ['birthDate', 'contractDate', 'attendanceDate', 'withdrawalDate'])
      if (r[field]) requireThat(dateOK(r[field]), `${field}: dată invalidă.`);
    if (r.attendanceDate && r.withdrawalDate)
      requireThat(r.withdrawalDate >= r.attendanceDate, 'Retragerea nu poate preceda începerea frecventării.');
    for (const [field, valueKey] of [
      ['feeHistory', 'amount'],
      ['statusHistory', 'status'],
    ]) {
      r[field] ??= [];
      requireThat(Array.isArray(r[field]) && r[field].length <= 1000, `${field}: istoric invalid.`);
      const seen = new Set();
      for (const item of r[field]) {
        requireThat(item && monthOK(item.from) && !seen.has(item.from), `${field}: lună invalidă sau repetată.`);
        seen.add(item.from);
        if (valueKey === 'amount') requireAmount(item.amount, 'Taxa istorică', true);
        else requireThat(STATUS_HISTORY_VALUES.includes(item.status), 'Statut istoric invalid.');
      }
      r[field].sort((a, b) => a.from.localeCompare(b.from));
    }
  } else if (type === 'groups') {
    text(r.name, 'Nume grupă', true);
    r.name = r.name.trim();
    if (r.capacity !== undefined && r.capacity !== null) {
      requireThat(
        Number.isInteger(r.capacity) && r.capacity >= 1 && r.capacity <= 1000,
        'Capacitatea trebuie să fie un număr întreg între 1 și 1000.',
      );
    } else r.capacity = null;
  } else if (type === 'categories') {
    text(r.name, 'Nume categorie', true);
    r.name = r.name.trim();
  } else {
    requireThat(dateOK(r.date), 'Data operațiunii este invalidă.');
    if (type === 'payments' && r.tenders !== undefined) {
      requireThat(
        Array.isArray(r.tenders) && r.tenders.length > 0 && r.tenders.length <= 10,
        'Completează cel puțin o sumă Cash, Card sau Transfer.',
      );
      const methods = new Set();
      let sum = 0;
      for (const part of r.tenders) {
        requireThat(part && typeof part === 'object', 'Componentă de achitare invalidă.');
        text(part.method, 'Metoda de achitare', true);
        part.method = part.method.trim();
        requireThat(!methods.has(part.method.toLowerCase()), 'Metodă de achitare repetată.');
        methods.add(part.method.toLowerCase());
        requireAmount(part.amount, 'Suma ' + part.method);
        sum += cents(part.amount);
      }
      if (r.amount !== undefined) {
        requireAmount(r.amount, 'Suma');
        requireThat(cents(r.amount) === sum, 'Totalul trebuie să fie egal cu suma Cash + Card + Transfer.');
      }
      r.amount = sum / 100;
      r.method = r.tenders.map(p => p.method).join(' + ');
    }
    requireAmount(r.amount, 'Suma');
    if (type === 'payments') {
      r.childId ??= '';
      text(r.childId, 'ID copil');
      r.method ||= 'Cash';
      r.allocations ??= r.month ? [{ month: r.month, amount: r.amount }] : [];
      requireThat(Array.isArray(r.allocations) && r.allocations.length <= 120, 'Repartizare invalidă.');
      const seen = new Set();
      let allocated = 0;
      for (const a of r.allocations) {
        requireThat(a && monthOK(a.month) && !seen.has(a.month), 'Lună de repartizare invalidă sau repetată.');
        seen.add(a.month);
        requireAmount(a.amount, 'Suma repartizată');
        allocated += cents(a.amount);
      }
      requireThat(allocated <= cents(r.amount), 'Repartizările depășesc suma plății.');
      r.month = r.allocations.length === 1 ? r.allocations[0].month : '';
    } else {
      r.category ||= 'Altele';
      r.description ??= '';
    }
  }
  return r;
}
export function validateState(input) {
  const s = emptyState();
  for (const type of TYPES) {
    requireThat(Array.isArray(input?.[type]) && input[type].length <= 100000, `Lista ${type} este invalidă.`);
    const seen = new Set();
    s[type] = input[type].map(r => {
      const clean = normalizeRecord(type, r);
      requireThat(!seen.has(clean.id), `ID repetat: ${clean.id}`);
      seen.add(clean.id);
      return clean;
    });
  }
  const ids = new Set(s.children.map(r => r.id));
  for (const p of s.payments)
    requireThat(!p.childId || ids.has(p.childId), `Plata ${p.id}: copilul ${p.childId} nu există.`);
  const groupIds = new Set(s.groups.map(g => g.id));
  for (const c of s.children)
    requireThat(!c.groupId || groupIds.has(c.groupId), `Copilul ${c.id}: grupa ${c.groupId} nu există.`);
  return s;
}
