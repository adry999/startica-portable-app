import { monthOK, dateOK } from './calendar-month.mjs';
import { cents } from './money.mjs';
import { TENDER_METHODS, normalizeTenderMethod } from './payment-allocations.mjs';
import { resolveStoredPhone } from './phone-number.mjs';

// `payerAliases` = tabelul „payer_aliases” din decizia 25 sept. 2026 (docs/design/README.md
// „Decizii funcții noi”) — numele e camelCase aici ca toate celelalte tipuri din TYPES, nu
// snake_case ca în textul deciziei.
export const TYPES = [
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
// Serviciul implicit al unei achitări (B3) — Grădiniță, mereu prezent, `system: true`.
export const DEFAULT_SERVICE_ID = 'gradinita';
export const POOL_SERVICE_ID = 'bazin';
// Cele 8 tonuri de pastilă din PillTone (webapp/src/shared/ui/FilterPills.tsx) — copiate aici
// ca record-schema.mjs (shared, server+web) să nu importe din webapp/.
export const SERVICE_TONES = ['orange', 'mint', 'yellow', 'pink', 'teal', 'blue', 'purple', 'coral'];
export const SERVICE_PRICE_MODES = ['free', 'fixed'];
// Tipurile de taxă suplimentară dintr-un `charges` (decizia 4, 2026-09-27-personal-bazin.md) — azi
// doar Bazin; un al doilea modul cu taxe suplimentare adaugă aici, nu inventează alt kind.
export const CHARGE_KINDS = ['bazin'];
// Stări reale, folosite de obligation() și acceptate în statusHistory.
export const STATUS_HISTORY_VALUES = ['Activ', 'Suspendat', 'Retras'];
// Statutul unei fișe. „De verificat” marchează o fișă importată a cărei
// situație nu este confirmată; nu este o stare din care se pot calcula
// obligații, deci nu apare în statusHistory.
export const CHILD_STATUSES = [...STATUS_HISTORY_VALUES, 'De verificat'];
export const CURRENCIES = ['MDL', 'EUR'];
// Drumul unei vizite: „reprogramată” e un eveniment în history, nu un statut propriu.
export const VISIT_STATUSES = ['Programată', 'Efectuată', 'Neprezentată', 'Înscris', 'Renunțat'];
// Echipa grupei (Personal 24, decizia 3 din docs/superpowers/plans/2026-09-27-personal-bazin.md):
// staff-ul e comun (baza „comun”), grupa e a filialei — de-aia trăiește pe `records`, nu ca kind separat.
export const GROUP_TEAM_ROLES = ['principal', 'asistent', 'inlocuitor'];
const TIME_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
/** @type {() => { children: any[], payments: any[], expenses: any[], groups: any[], categories: any[], visits: any[], charges: any[], payerAliases: any[], services: any[] }} */
export const emptyState = () => ({
  children: [],
  payments: [],
  expenses: [],
  groups: [],
  categories: [],
  visits: [],
  charges: [],
  payerAliases: [],
  services: [],
});

// Cele 2 servicii de sistem (B3) — id fix, nu se șterg/redenumesc; taxa lunară și Bazinul
// depind de ele. O instalare nouă pornește cu ele; una existentă le primește la deschidere
// (vezi seedServices în #features/services/server, ca la missingDefaultCategorySeeds).
/** @type {import('#shared/contracts/record-types.mjs').Service[]} */
export const DEFAULT_SERVICE_SEEDS = [
  { id: DEFAULT_SERVICE_ID, name: 'Grădiniță', order: 0, tone: 'orange', priceMode: 'free', system: true },
  { id: POOL_SERVICE_ID, name: 'Bazin', order: 1, tone: 'blue', priceMode: 'free', system: true },
];
/** Semințele lipsă dintr-un instantaneu (instalare existentă fără `services`, sau import vechi). */
export function missingDefaultServiceSeeds(state) {
  const existingIds = new Set((state.services ?? []).map(service => service.id));
  return DEFAULT_SERVICE_SEEDS.filter(seed => !existingIds.has(seed.id));
}
// Câmpurile per tip care duc date medicale în clar: excluse din export
// (stripSensitiveFields) și redactate în istoric (redactSensitiveFields). O
// intrare nouă în TYPES cu un câmp sensibil trebuie adăugată aici.
export const SENSITIVE_FIELDS = { visits: ['healthNotes'], children: ['healthNotes'] };
/** Copie a înregistrării fără câmpurile sensibile — folosită la export. */
export function stripSensitiveFields(type, record) {
  const fields = SENSITIVE_FIELDS[type];
  if (!record || !fields?.length) return record;
  const copy = { ...record };
  for (const field of fields) delete copy[field];
  return copy;
}
/** Copie a înregistrării cu valorile sensibile ne-goale înlocuite — folosită în istoric. */
export function redactSensitiveFields(type, record) {
  const fields = SENSITIVE_FIELDS[type];
  if (!record || !fields?.length) return record;
  const copy = { ...record };
  for (const field of fields) if (copy[field]) copy[field] = '[date medicale]';
  return copy;
}
export function requireThat(ok, message) {
  if (!ok) throw new Error(message);
}
function text(v, field, required = false) {
  requireThat(
    typeof v === 'string' && v.length <= 10000 && (!required || v.trim()),
    `${field}: text invalid sau lipsă.`,
  );
}
// §10 (02.10) — un singur format salvat: un mobil moldovenesc valid devine E.164, un „alt număr"
// cu „+” rămâne cum a fost scris, orice altceva rămâne cum a fost scris dar marcat `<field>Invalid`
// (bannerul „de verificat”, §9.3/§14, nu construit aici, îl va găsi după asta). Câmpul lipsă
// (`undefined`, nu trimis) rămâne neatins — o fișă veche, fără `phone2`, nu primește unul gol.
function applyPhoneField(record, field, invalidField) {
  if (record[field] === undefined) return;
  const resolved = resolveStoredPhone(record[field]);
  record[field] = resolved.value;
  if (resolved.invalid) record[invalidField] = true;
  else delete record[invalidField];
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
    'firstName',
    'lastName',
    'contractNumber',
    'parent',
    'phone',
    'phoneInvalid',
    'parentRelation',
    'parent2',
    'phone2',
    'phone2Invalid',
    'parent2Relation',
    'pickupPersons',
    'healthNotes',
    'idnp',
    'address',
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
    // 44b (PROMPT-8 §13): comun tuturor achitărilor dintr-o singură plată „+ Adaugă fratele" —
    // un rând per copil, un singur bon (§11.2). Spre deosebire de `group` (mort, niciodată citit),
    // ăsta chiar leagă înregistrări între ele.
    'receiptGroupId',
    'month',
    'method',
    'service',
    'tenders',
    'amount',
    'currency',
    'fxRate',
    'fxRateSource',
    'amountEur',
    'receiptNumber',
    'roundingDiff',
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
    'method',
    'description',
    'amount',
    'notes',
    'importSource',
    'archived',
    'archivedAt',
  ]),
  groups: new Set(['id', 'name', 'capacity', 'educator', 'team', 'order', 'tone', 'ageMinYears', 'ageMaxYears']),
  categories: new Set(['id', 'name']),
  visits: new Set([
    'id',
    'name',
    'birthDate',
    'parent',
    'phone',
    'phoneInvalid',
    'parent2',
    'phone2',
    'phone2Invalid',
    'date',
    'time',
    'status',
    'statusChangedAt',
    'history',
    'desiredStartDate',
    'desiredGroupId',
    'source',
    'healthNotes',
    'postVisitNotes',
    'notes',
    'childId',
    'archived',
    'archivedAt',
  ]),
  // O taxă suplimentară a lunii (azi doar Bazin — decizia 4, 2026-09-27-personal-bazin.md), linie
  // separată în obligation(), nu o mutație a copilului: id determinist per (childId, month, kind)
  // scris de modulul care o generează (ex. Pool la „Închide luna”), idempotent la reînchidere.
  charges: new Set(['id', 'childId', 'month', 'kind', 'label', 'amount', 'currency', 'date']),
  // Un plătitor reținut (Asociere achitări, 11-de-rezolvat.md §9c, decizia 25 sept. 2026): leagă
  // textul plătitorului din extrasul bancar (payment.sourceName) de un copil, ca sugestia să
  // apară primă, cu motivul „Plătitor reținut”, la următoarea achitare de la același plătitor.
  // Fără arhivare — se șterge direct din fișa copilului (09-copii-fisa.md).
  payerAliases: new Set(['id', 'alias', 'childId', 'createdAt']),
  // Un serviciu pe care se poate face o achitare (B3) — Grădiniță/Bazin sunt `system: true`.
  services: new Set(['id', 'name', 'order', 'tone', 'priceMode', 'price', 'hidden', 'system']),
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
  // Sentinela „neafirmat” e '' sau null (vezi bulk-selection.mjs, record-editor-dialog.mjs);
  // doar o valoare adevărată trebuie să fie o dată ISO validă.
  if (record.archivedAt)
    requireThat(
      typeof record.archivedAt === 'string' && !Number.isNaN(Date.parse(record.archivedAt)),
      'Data arhivării este invalidă.',
    );
  if (record.reviewed !== undefined) requireThat(typeof record.reviewed === 'boolean', 'Verificare invalidă.');
  // Obiect liber (kind/recordId/recordDigest/provisionalAmount/autoMatched — vezi
  // financial-history-import.mjs și review-center.mjs), nu text.
  if (record.importSource !== undefined)
    requireThat(
      record.importSource !== null && typeof record.importSource === 'object' && !Array.isArray(record.importSource),
      'Sursă import invalidă.',
    );
  for (const field of [
    'notes',
    'verification',
    'original',
    'sourceName',
    'childName',
    'sourceChildId',
    'type',
    'description',
    'parent',
    'phone',
    'parentRelation',
    'parent2',
    'phone2',
    'parent2Relation',
    'contractNumber',
    'group',
    'category',
    'method',
    'source',
    'healthNotes',
    'postVisitNotes',
    'educator',
    'firstName',
    'lastName',
    'address',
  ])
    // `notes` la `children` e o listă de note cu dată (CF-4, 09-copii-fisa.md), nu text liber —
    // validată mai jos, împreună cu feeHistory/statusHistory.
    if (!(field === 'notes' && type === 'children') && record[field] !== undefined) text(record[field], field);
  if (type === 'children') {
    text(record.name, 'Nume copil', true);
    record.name = record.name.trim();
    if (record.firstName !== undefined) record.firstName = record.firstName.trim();
    if (record.lastName !== undefined) record.lastName = record.lastName.trim();
    // `name` rămâne sursa unică pentru căutare/sortare/inițiale/CSV/Excel/chitanțe: dacă
    // formularul „Copil nou” trimite ambele câmpuri, `name` se recalculează din ele; dacă
    // e trimis doar unul, nu se atinge `name` (ar putea mutila un nume scris manual).
    if (record.firstName && record.lastName) record.name = `${record.lastName} ${record.firstName}`.trim();
    if (record.idnp !== undefined) {
      text(record.idnp, 'IDNP');
      record.idnp = record.idnp.trim();
      if (record.idnp === '') delete record.idnp;
      else requireThat(/^\d{13}$/.test(record.idnp), 'IDNP: trebuie să aibă exact 13 cifre.');
    }
    if (record.address !== undefined) record.address = record.address.trim();
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
    applyPhoneField(record, 'phone', 'phoneInvalid');
    applyPhoneField(record, 'phone2', 'phone2Invalid');
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
        if (valueKey === 'amount') {
          requireAmount(historyEntry.amount, 'Taxa istorică', true);
          historyEntry.currency ??= 'MDL';
          requireThat(CURRENCIES.includes(historyEntry.currency), `${field}: monedă necunoscută.`);
        } else requireThat(STATUS_HISTORY_VALUES.includes(historyEntry.status), 'Statut istoric invalid.');
      }
      record[field].sort((a, b) => a.from.localeCompare(b.from));
    }
    // Note (CF-4, 09-copii-fisa.md): listă, nu text liber — cea mai recentă primul rând, pe
    // yellow-soft în fișă. Migrarea 003 (bază) + upgradeSnapshot() (import/restaurare) convertesc
    // un `notes` vechi de tip text într-o listă cu o singură intrare, înainte să ajungă aici.
    record.notes ??= [];
    requireThat(Array.isArray(record.notes) && record.notes.length <= 500, 'Note: listă invalidă.');
    const seenNoteIds = new Set();
    record.notes = record.notes.map(note => {
      requireThat(note && typeof note === 'object', 'Notă invalidă.');
      const id = typeof note.id === 'string' && note.id ? note.id : `NOTE-${crypto.randomUUID()}`;
      requireThat(!seenNoteIds.has(id), 'Notă: id repetat.');
      seenNoteIds.add(id);
      text(note.text, 'Text notă', true);
      requireThat(dateOK(note.date), 'Notă: dată invalidă.');
      // A3: autor/editare/ștergere (simplificare față de kind-ul separat din spec 28 — rămân pe
      // Child, vezi INTREBARI.md).
      if (note.author !== undefined) text(note.author, 'Autor notă');
      if (note.updatedAt !== undefined)
        requireThat(
          typeof note.updatedAt === 'string' && !Number.isNaN(Date.parse(note.updatedAt)),
          'Notă: dată de editare invalidă.',
        );
      if (note.deletedAt !== undefined && note.deletedAt !== null)
        requireThat(
          typeof note.deletedAt === 'string' && !Number.isNaN(Date.parse(note.deletedAt)),
          'Notă: dată de ștergere invalidă.',
        );
      return {
        id,
        text: note.text.trim(),
        date: note.date,
        ...(note.author !== undefined && { author: note.author.trim() }),
        ...(note.updatedAt !== undefined && { updatedAt: note.updatedAt }),
        ...(note.deletedAt !== undefined && { deletedAt: note.deletedAt }),
      };
    });
    record.notes.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    // A3: până la 10 persoane autorizate (dincolo de cei 2 părinți) — Copii.dc.html#2b.
    if (record.pickupPersons !== undefined) {
      requireThat(
        Array.isArray(record.pickupPersons) && record.pickupPersons.length <= 10,
        'Persoane autorizate: listă invalidă.',
      );
      const seenPickupIds = new Set();
      record.pickupPersons = record.pickupPersons.map(person => {
        requireThat(person && typeof person === 'object', 'Persoană autorizată invalidă.');
        const id = typeof person.id === 'string' && person.id ? person.id : `PICKUP-${crypto.randomUUID()}`;
        requireThat(!seenPickupIds.has(id), 'Persoană autorizată: id repetat.');
        seenPickupIds.add(id);
        text(person.name, 'Nume persoană autorizată', true);
        if (person.relation !== undefined) text(person.relation, 'Relație persoană autorizată');
        if (person.phone !== undefined) text(person.phone, 'Telefon persoană autorizată');
        if (person.note !== undefined) text(person.note, 'Notă persoană autorizată');
        return {
          id,
          name: person.name.trim(),
          ...(person.relation !== undefined && { relation: person.relation.trim() }),
          // §10: la fel ca phone/phone2, dar fără `phoneInvalid` propriu — e o listă liberă, nu
          // o fișă cu banner „de verificat” (acela se uită doar la copil/vizită/angajat).
          ...(person.phone !== undefined && { phone: resolveStoredPhone(person.phone).value }),
          ...(person.note !== undefined && { note: person.note.trim() }),
        };
      });
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
    record.team ??= [];
    requireThat(Array.isArray(record.team) && record.team.length <= 50, 'Echipa grupei este invalidă.');
    record.team = record.team.map(member => {
      requireThat(
        member && typeof member === 'object' && typeof member.staffId === 'string' && member.staffId,
        'Membru de echipă invalid.',
      );
      requireThat(
        GROUP_TEAM_ROLES.includes(member.role),
        `Rol de echipă invalid: folosește ${GROUP_TEAM_ROLES.join(', ')}.`,
      );
      const normalized = { staffId: member.staffId, role: member.role };
      if (member.days !== undefined) {
        requireThat(
          Array.isArray(member.days) && member.days.every(day => Number.isInteger(day) && day >= 1 && day <= 5),
          'Zilele din echipa grupei trebuie să fie între 1 și 5.',
        );
        normalized.days = member.days;
      }
      return normalized;
    });
    requireThat(
      record.team.filter(member => member.role === 'principal').length <= 1,
      'Grupa poate avea un singur membru principal.',
    );
    if (record.order !== undefined)
      requireThat(
        Number.isInteger(record.order) && record.order >= 0 && record.order <= 100000,
        'Ordinea grupei este invalidă.',
      );
    if (record.tone !== undefined) text(record.tone, 'Culoarea grupei');
    for (const field of ['ageMinYears', 'ageMaxYears'])
      if (record[field] !== undefined)
        requireThat(
          Number.isInteger(record[field]) && record[field] >= 0 && record[field] <= 18,
          `${field}: vârstă invalidă.`,
        );
    if (record.ageMinYears !== undefined && record.ageMaxYears !== undefined)
      requireThat(record.ageMinYears <= record.ageMaxYears, 'Vârsta minimă nu poate fi mai mare decât cea maximă.');
  } else if (type === 'categories') {
    text(record.name, 'Nume categorie', true);
    record.name = record.name.trim();
  } else if (type === 'visits') {
    text(record.name, 'Nume copil', true);
    record.name = record.name.trim();
    if (record.birthDate) requireThat(dateOK(record.birthDate), 'Data nașterii este invalidă.');
    text(record.parent, 'Părinte', true);
    record.parent = record.parent.trim();
    record.phone ??= '';
    record.parent2 ??= '';
    record.phone2 ??= '';
    applyPhoneField(record, 'phone', 'phoneInvalid');
    applyPhoneField(record, 'phone2', 'phone2Invalid');
    requireThat(dateOK(record.date), 'Data vizitei este invalidă.');
    requireThat(typeof record.time === 'string' && TIME_OK.test(record.time), 'Ora vizitei este invalidă.');
    record.status ||= 'Programată';
    text(record.status, 'Statut', true);
    requireThat(VISIT_STATUSES.includes(record.status), `Statut: folosește ${VISIT_STATUSES.join(', ')}.`);
    requireThat(
      typeof record.statusChangedAt === 'string' && !Number.isNaN(Date.parse(record.statusChangedAt)),
      'Data schimbării de statut este invalidă.',
    );
    record.history ??= [];
    requireThat(Array.isArray(record.history) && record.history.length <= 1000, 'history: istoric invalid.');
    let previousAt = -Infinity;
    for (const entry of record.history) {
      requireThat(
        entry &&
          typeof entry.at === 'string' &&
          !Number.isNaN(Date.parse(entry.at)) &&
          VISIT_STATUSES.includes(entry.status) &&
          dateOK(entry.date) &&
          typeof entry.time === 'string' &&
          TIME_OK.test(entry.time),
        'history: intrare invalidă.',
      );
      const at = Date.parse(entry.at);
      requireThat(at >= previousAt, 'history: intrările trebuie să fie ordonate cronologic.');
      previousAt = at;
    }
    if (record.desiredStartDate) requireThat(dateOK(record.desiredStartDate), 'Data dorită de start este invalidă.');
    record.desiredGroupId ??= null;
    if (record.desiredGroupId !== null)
      requireThat(
        typeof record.desiredGroupId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(record.desiredGroupId),
        'Grupa dorită este invalidă.',
      );
    record.source ??= '';
    record.healthNotes ??= '';
    record.postVisitNotes ??= '';
    record.childId ??= '';
    text(record.childId, 'ID copil');
    if (record.status === 'Înscris') requireThat(!!record.childId, 'Vizita înscrisă trebuie să aibă un copil asociat.');
    else requireThat(!record.childId, 'Doar o vizită înscrisă poate avea un copil asociat.');
  } else if (type === 'charges') {
    requireThat(dateOK(record.date), 'Data taxei este invalidă.');
    requireAmount(record.amount, 'Suma');
    text(record.childId, 'ID copil', true);
    requireThat(/^[A-Za-z0-9_-]{1,100}$/.test(record.childId), 'ID copil invalid.');
    requireThat(monthOK(record.month), 'Lună invalidă.');
    text(record.kind, 'Tip taxă', true);
    requireThat(CHARGE_KINDS.includes(record.kind), `Tip taxă necunoscut: folosește ${CHARGE_KINDS.join(', ')}.`);
    text(record.label, 'Etichetă', true);
    record.currency ??= 'MDL';
    requireThat(CURRENCIES.includes(record.currency), 'Monedă necunoscută.');
  } else if (type === 'payerAliases') {
    text(record.alias, 'Plătitor', true);
    record.alias = record.alias.trim();
    text(record.childId, 'ID copil', true);
    requireThat(/^[A-Za-z0-9_-]{1,100}$/.test(record.childId), 'ID copil invalid.');
    requireThat(
      typeof record.createdAt === 'string' && !Number.isNaN(Date.parse(record.createdAt)),
      'Data creării este invalidă.',
    );
  } else if (type === 'services') {
    text(record.name, 'Nume', true);
    record.name = record.name.trim();
    requireThat(SERVICE_TONES.includes(record.tone), `Ton necunoscut: folosește ${SERVICE_TONES.join(', ')}.`);
    requireThat(
      SERVICE_PRICE_MODES.includes(record.priceMode),
      `Mod de preț necunoscut: folosește ${SERVICE_PRICE_MODES.join(', ')}.`,
    );
    if (record.priceMode === 'fixed') requireAmount(record.price, 'Preț');
    else delete record.price;
    record.hidden = !!record.hidden;
    record.system = !!record.system;
    if (record.order !== undefined) requireThat(Number.isFinite(record.order), 'Ordine invalidă.');
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
        part.method = normalizeTenderMethod(part.method);
        requireThat(TENDER_METHODS.includes(part.method), `Metodă de achitare necunoscută: ${part.method}.`);
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
      if (record.childId) requireThat(/^[A-Za-z0-9_-]{1,100}$/.test(record.childId), 'ID copil invalid.');
      record.currency ??= 'MDL';
      requireThat(CURRENCIES.includes(record.currency), 'Monedă necunoscută.');
      if (record.fxRate !== undefined)
        requireThat(Number.isFinite(record.fxRate) && record.fxRate > 0, 'Curs invalid.');
      if (record.fxRateSource !== undefined)
        requireThat(['bnm', 'manual'].includes(record.fxRateSource), 'Proveniența cursului este invalidă.');
      if (record.amountEur !== undefined)
        requireThat(Number.isFinite(record.amountEur) && record.amountEur > 0, 'Sumă în euro invalidă.');
      if (record.receiptNumber !== undefined)
        requireThat(
          Number.isInteger(record.receiptNumber) && record.receiptNumber >= 1,
          'Numărul confirmării de plată este invalid.',
        );
      if (record.roundingDiff !== undefined)
        requireThat(Number.isFinite(record.roundingDiff), 'Diferența de rotunjire este invalidă.');
      record.method ||= 'Cash';
      record.service ||= DEFAULT_SERVICE_ID;
      text(record.service, 'Serviciu', true);
      // AUDIT-COD-02-10-B.md #2: dacă un viitor apelant pune `amountEur` + `month` fără
      // `allocations` explicit, repartizarea implicită trebuie să fie tot în euro — altfel ar
      // scrie suma în lei ca repartizare „în euro" (allocationCurrency() citește moneda după
      // `amountEur`), aceeași clasă de corupere ca la #1 (fxrate-backfill).
      record.allocations ??= record.month ? [{ month: record.month, amount: record.amountEur ?? record.amount }] : [];
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
      // AUDIT-COD-02-10-B.md #2: pentru un copil cu tarif EUR, allocations[] e în EURO
      // (allocationCurrency() din payment-allocations.mjs decide asta după `amountEur`), dar
      // `record.amount` rămâne mereu în LEI (suma tenders-urilor) — comparate direct, garda nu mai
      // prinde nimic (~20x diferență de scară). `amountEur` e sursa corectă când există.
      requireThat(allocated <= cents(record.amountEur ?? record.amount), 'Repartizările depășesc suma plății.');
      record.month = record.allocations.length === 1 ? record.allocations[0].month : '';
    } else {
      // General e categoria de rezervă (nu Altele, deletabilă ca oricare alta) — vezi
      // #shared/domain/expense-categories.mjs.
      record.category ||= 'General';
      record.description ??= '';
      // Fără implicit: cheltuielile vechi, fără metodă, trebuie să rămână așa
      // la re-salvare — implicitul 'cash' e doar în formularul de creare (UI).
      if (record.method !== undefined)
        requireThat(['cash', 'card', 'transfer'].includes(record.method), 'Metodă necunoscută.');
    }
  }
  return record;
}
export function validateState(input) {
  const state = emptyState();
  for (const type of TYPES) {
    // Lipsă = listă goală, nu eroare: un export Excel sau un backup dinainte ca acest tip să
    // existe (ex. `charges`, adăugat de Bazin) nu trebuie să blocheze reimportul — la fel cum
    // upgradeSnapshot() tratează deja un tip lipsă.
    const list = input?.[type] ?? [];
    requireThat(Array.isArray(list) && list.length <= 100000, `Lista ${type} este invalidă.`);
    const seen = new Set();
    state[type] = list.map(rawRecord => {
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
  for (const visit of state.visits)
    requireThat(!visit.childId || ids.has(visit.childId), `Vizita ${visit.id}: copilul ${visit.childId} nu există.`);
  for (const visit of state.visits)
    requireThat(
      !visit.desiredGroupId || groupIds.has(visit.desiredGroupId),
      `Vizita ${visit.id}: grupa ${visit.desiredGroupId} nu există.`,
    );
  for (const charge of state.charges)
    requireThat(ids.has(charge.childId), `Taxa ${charge.id}: copilul ${charge.childId} nu există.`);
  // payerAliases nu are un requireThat echivalent, intenționat: spre deosebire de charges (generat
  // și șters de Bazin în același ciclu cu copilul), un alias poate supraviețui ștergerii copilului
  // pe care îl leagă (backup vechi, restaurare parțială) — validateState() nu trebuie să blocheze
  // reimportul din cauza unei referințe moarte pe o simplă comoditate de sugestie.
  return state;
}
