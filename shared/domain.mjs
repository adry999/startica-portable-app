export const TYPES = ['children', 'payments', 'expenses'];
// Stări reale, folosite de obligation() și acceptate în statusHistory.
export const STATUS_HISTORY_VALUES = ['Activ', 'Suspendat', 'Retras'];
// Statutul unei fișe. „De verificat” marchează o fișă importată a cărei
// situație nu este confirmată; nu este o stare din care se pot calcula
// obligații, deci nu apare în statusHistory.
export const CHILD_STATUSES = [...STATUS_HISTORY_VALUES, 'De verificat'];
export const emptyState = () => ({ children: [], payments: [], expenses: [] });
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const cents = value => Math.round(Number(value) * 100);
export const total = rows => rows.reduce((s, r) => s + cents(r.amount), 0) / 100;
export function monthOK(v) {
  return (
    typeof v === 'string' &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(v) &&
    Number(v.slice(0, 4)) >= 1900 &&
    Number(v.slice(0, 4)) <= 2200
  );
}
export function dateOK(v) {
  return (
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    monthOK(v.slice(0, 7)) &&
    new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v
  );
}
function requireThat(ok, message) {
  if (!ok) throw new Error(message);
}
function text(v, field, required = false) {
  requireThat(
    typeof v === 'string' && v.length <= 10000 && (!required || v.trim()),
    `${field}: text invalid sau lipsă.`,
  );
}
function amount(v, field, zero = false) {
  requireThat(
    typeof v === 'number' &&
      Number.isFinite(v) &&
      (zero ? v >= 0 : v > 0) &&
      v <= 100000000 &&
      Math.abs(v * 100 - Math.round(v * 100)) < 0.00001,
    `${field}: folosește o sumă validă, cu cel mult doi zecimali.`,
  );
}
export function normalizeRecord(type, input) {
  requireThat(
    TYPES.includes(type) && input && typeof input === 'object' && !Array.isArray(input),
    'Înregistrare invalidă.',
  );
  const r = structuredClone(input);
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
    r.group ??= '';
    r.parent ??= '';
    r.phone ??= '';
    r.fee ??= null;
    if (r.fee !== null) amount(r.fee, 'Taxa', true);
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
        if (valueKey === 'amount') amount(item.amount, 'Taxa istorică', true);
        else requireThat(STATUS_HISTORY_VALUES.includes(item.status), 'Statut istoric invalid.');
      }
      r[field].sort((a, b) => a.from.localeCompare(b.from));
    }
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
        amount(part.amount, 'Suma ' + part.method);
        sum += cents(part.amount);
      }
      if (r.amount !== undefined) {
        amount(r.amount, 'Suma');
        requireThat(cents(r.amount) === sum, 'Totalul trebuie să fie egal cu suma Cash + Card + Transfer.');
      }
      r.amount = sum / 100;
      r.method = r.tenders.map(p => p.method).join(' + ');
    }
    amount(r.amount, 'Suma');
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
        amount(a.amount, 'Suma repartizată');
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
// O intrare de istoric pe lună: rescrie luna dacă există deja.
const upsertMonth = (rows, from, key, value) => [...(rows || []).filter(r => r.from !== from), { from, [key]: value }];

// Completarea în masă a taxei, grupei și statutului. Fără taxă ȘI statut,
// obligation() nu poate calcula nimic, deci ambele se scriu în istoric din
// aceeași lună — de regulă luna începerii frecventării, ca și lunile trecute
// să fie evaluate corect.
export function applyChildSetup(child, setup) {
  requireThat(setup && typeof setup === 'object', 'Completare invalidă.');
  requireThat(monthOK(setup.from), `${child.id}: luna de aplicare este invalidă.`);
  const r = structuredClone(child);
  if (setup.group !== undefined) {
    text(setup.group, 'Grupă');
    r.group = setup.group.trim();
  }
  if (setup.fee !== undefined && setup.fee !== null) {
    amount(setup.fee, `${child.name}: taxa`, true);
    r.fee = setup.fee;
    r.feeHistory = upsertMonth(r.feeHistory, setup.from, 'amount', setup.fee);
  }
  if (setup.status !== undefined && setup.status !== '') {
    requireThat(STATUS_HISTORY_VALUES.includes(setup.status), `${child.name}: statut invalid.`);
    r.status = setup.status;
    r.statusHistory = upsertMonth(r.statusHistory, setup.from, 'status', setup.status);
  }
  return normalizeRecord('children', r);
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
  return s;
}
export function summary(s) {
  return {
    children: s.children.length,
    payments: s.payments.length,
    expenses: s.expenses.length,
    paymentTotal: total(s.payments),
    expenseTotal: total(s.expenses),
  };
}
export function issues(s) {
  const result = [];
  const add = (type, r, reason) =>
    result.push({ type, id: r.id, name: r.name || r.childName || r.sourceName || r.description || r.id, reason });
  for (const c of s.children.filter(r => !r.archived)) {
    if (!c.feeHistory?.length) add('children', c, c.fee == null ? 'Taxă lipsă' : 'Taxă fără lună de aplicare');
    if (!c.group) add('children', c, 'Grupă lipsă');
    if (!c.attendanceDate) add('children', c, 'Data începerii frecventării lipsește');
    if (!STATUS_HISTORY_VALUES.includes(c.status)) add('children', c, 'Statut de verificat');
    if (c.parent && c.name && c.parent.trim().toLocaleLowerCase('ro-RO') === c.name.trim().toLocaleLowerCase('ro-RO'))
      add('children', c, 'Părintele are același nume ca copilul; verifică sursa');
    if (
      c.birthDate &&
      ((c.contractDate && c.birthDate > c.contractDate) || (c.attendanceDate && c.birthDate > c.attendanceDate))
    )
      add('children', c, 'Data nașterii este după contract / începutul frecventării');
  }
  const fingerprints = new Map();
  for (const p of s.payments.filter(r => !r.archived)) {
    if (!p.childId) add('payments', p, 'Copil neasociat');
    if ((p.allocations || []).reduce((n, a) => n + cents(a.amount), 0) < cents(p.amount))
      add('payments', p, 'Avans nerepartizat');
    if (p.verification && !/^OK$/i.test(p.verification.trim()) && !p.reviewed)
      add('payments', p, `Verificare import: ${p.verification}`);
    const fingerprint = JSON.stringify([p.childId || p.sourceName || p.childName, p.date, cents(p.amount), p.method]);
    if (fingerprints.has(fingerprint)) add('payments', p, `Posibil duplicat cu ${fingerprints.get(fingerprint)}`);
    else fingerprints.set(fingerprint, p.id);
  }
  return result;
}
export function importReport(input) {
  try {
    const state = validateState(input);
    return { state, summary: summary(state), warnings: issues(state), errors: [] };
  } catch (error) {
    return { errors: [error.message], warnings: [] };
  }
}
export function allocations(p) {
  return p.allocations ?? (p.month ? [{ month: p.month, amount: p.amount }] : []);
}
export function paymentTenders(p) {
  return p.tenders ?? [{ method: p.method || 'Cash', amount: p.amount || 0 }];
}
// Cu câte zile înainte de scadență apare copilul pe lista de notificat.
export const NOTICE_DAYS = 3;
// Ora fixă la prânz UTC: aritmetica pe zile nu este afectată de ora de vară.
const shiftDays = (day, delta) =>
  new Date(new Date(day + 'T12:00:00Z').getTime() + delta * 86400000).toISOString().slice(0, 10);
const daysBetween = (from, to) => Math.round((new Date(to + 'T12:00:00Z') - new Date(from + 'T12:00:00Z')) / 86400000);
// Scadența lunară este ziua din data contractului. dueDay rămâne ca rezervă
// pentru fișele fără contract completat.
export function dueDayFor(child) {
  const fromContract = Number(child.contractDate?.slice(8, 10));
  return fromContract >= 1 && fromContract <= 31 ? fromContract : child.dueDay || 10;
}
// Cât s-a încasat, pe copil și pe lună, calculat o singură dată. Fără index,
// obligation() reciteşte toate plățile pentru fiecare copil, deci un tabel cu
// N copii și M plăți costă N×M. asOf nedefinit înseamnă „fără limită de dată”.
export function paymentIndex(payments, asOf) {
  const index = new Map();
  for (const p of payments) {
    if (p.archived || !p.childId || (asOf && p.date > asOf)) continue;
    let months = index.get(p.childId);
    if (!months) index.set(p.childId, (months = new Map()));
    for (const a of allocations(p)) months.set(a.month, (months.get(a.month) || 0) + cents(a.amount));
  }
  return index;
}
// `index` este opțional: dacă lipsește, se calculează pe loc, ca apelurile
// izolate (un singur copil, o singură lună) să rămână simple.
export function obligation(child, month, payments, asOf = today(), index = null) {
  const start = child.attendanceDate?.slice(0, 7),
    end = child.withdrawalDate?.slice(0, 7);
  const history = [...(child.statusHistory || [])]
    .sort((a, b) => a.from.localeCompare(b.from))
    .filter(r => r.from <= month);
  const status = history.at(-1)?.status || (!child.statusHistory?.length && child.status === 'Activ' ? 'Activ' : null);
  const paid = index
    ? (index.get(child.id)?.get(month) || 0) / 100
    : payments
        .filter(p => !p.archived && p.childId === child.id && p.date <= asOf)
        .reduce(
          (sum, p) =>
            sum +
            allocations(p)
              .filter(a => a.month === month)
              .reduce((n, a) => n + cents(a.amount), 0),
          0,
        ) / 100;
  const inactive = (start && month < start) || (end && month > end) || status === 'Suspendat' || status === 'Retras';
  const fees = [...(child.feeHistory || [])].sort((a, b) => a.from.localeCompare(b.from));
  // A current fee without an effective date must never be applied to past months.
  const fee = fees.filter(f => f.from <= month).at(-1)?.amount ?? null;
  const unknown = !inactive && (!start || !status || fee === null);
  const expected = inactive ? 0 : unknown ? null : fee;
  const rest = expected === null ? null : Math.max(0, cents(expected) - cents(paid)) / 100;
  const credit = expected === null ? null : Math.max(0, cents(paid) - cents(expected)) / 100;
  const [year, m] = month.split('-').map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  const due = `${month}-${String(Math.min(dueDayFor(child), lastDay)).padStart(2, '0')}`;
  const noticeFrom = shiftDays(due, -NOTICE_DAYS);
  // Ce trebuie notificat: are de plată și fie a trecut scadența, fie intră în
  // fereastra de avertizare. Ecranul „De notificat” filtrează exact pe asta.
  const notify = !inactive && !unknown && rest > 0 && asOf >= noticeFrom;
  const daysToDue = daysBetween(asOf, due);
  const label = inactive
    ? 'Fără obligație'
    : unknown
      ? 'De verificat'
      : rest === 0
        ? 'Plătit'
        : asOf > due
          ? 'Restanță'
          : paid > 0
            ? 'Plată parțială'
            : asOf >= noticeFrom
              ? 'Scadent în curând'
              : 'Nescadent';
  return { expected, paid, rest, credit, due, label, notify, daysToDue };
}
export function cashSummary(s, month) {
  const payments = s.payments.filter(p => !p.archived && p.date.startsWith(month));
  const income = total(payments),
    byMethod = { Cash: 0, Card: 0, Transfer: 0, Altele: 0 };
  for (const p of payments)
    for (const part of paymentTenders(p)) {
      const method = Object.hasOwn(byMethod, part.method) ? part.method : 'Altele';
      byMethod[method] += cents(part.amount);
    }
  for (const method of Object.keys(byMethod)) byMethod[method] /= 100;
  const expense = total(s.expenses.filter(p => !p.archived && p.date.startsWith(month)));
  return { income, expense, net: (cents(income) - cents(expense)) / 100, byMethod };
}
