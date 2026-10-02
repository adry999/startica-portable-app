export type RecordType =
  'children' | 'payments' | 'expenses' | 'groups' | 'categories' | 'visits' | 'charges' | 'payerAliases' | 'services';

/** YYYY-MM */
export type MonthKey = string;
/** YYYY-MM-DD */
export type DateKey = string;

export type ChildStatus = 'Activ' | 'Suspendat' | 'Retras' | 'De verificat';
export type EffectiveChildStatus = Exclude<ChildStatus, 'De verificat'>;

export type Currency = 'MDL' | 'EUR';

/** O notă din fișa copilului (CF-4, 09-copii-fisa.md) — listă, nu text liber, ca fiecare
 * intrare să-și păstreze data la care a fost scrisă.
 * `author`/`updatedAt`/`deletedAt` (A3, 29.09): simplificare deliberată față de kind-ul separat
 * `child_notes` din screens/28-fisa-copilului-date.md — rămân pe Child (risc teoretic de conflict
 * pe fișă la două note scrise simultan pe calculatoare diferite, acceptat pentru acum, vezi INTREBARI.md). */
export interface ChildNote {
  id: string;
  text: string;
  date: DateKey;
  /** deviceName din /api/session dacă sincronizarea e configurată, altfel „”. */
  author?: string;
  /** ISO — prezent doar dacă nota a fost editată după creare („· editată” în UI). */
  updatedAt?: string;
  /** ISO — ștergere „soft”, cu „Anulează” din toast; notele șterse nu apar în fișă. */
  deletedAt?: string | null;
}

/** O persoană (alta decât cei 2 părinți) autorizată să ridice copilul (A3, Copii.dc.html#2b). */
export interface PickupPerson {
  id: string;
  name: string;
  relation?: string;
  phone?: string;
  /** Ex. „marți, joi”. */
  note?: string;
}

export interface Child {
  id: string;
  name: string;
  /** Nume/prenume separate (formularul „Copil nou”); `name` rămâne sursa unică pentru
   * căutare/sortare/inițiale/CSV/Excel/chitanțe — vezi normalizeRecord(). */
  firstName?: string;
  lastName?: string;
  contractNumber?: string;
  parent: string;
  phone: string;
  /** „Mamă”, „Tată”, „Bunică”… liber, ≤ 40 (A2, screens/29-copil-nou-diferente.md). */
  parentRelation?: string;
  parent2?: string;
  phone2?: string;
  parent2Relation?: string;
  /** ≤ 10 (A3, Copii.dc.html#2b). */
  pickupPersons?: PickupPerson[];
  /** Sensibil (SENSITIVE_FIELDS): exclus din export, redactat în istoric, golit la 12 luni de la archivedAt. */
  healthNotes?: string;
  /** IDNP, exact 13 cifre (CF-2, 09-copii-fisa.md). */
  idnp?: string;
  address?: string;
  birthDate?: DateKey;
  contractDate?: DateKey;
  attendanceDate?: DateKey;
  withdrawalDate?: DateKey;
  groupId: string | null;
  status: ChildStatus;
  statusHistory: { from: MonthKey; status: EffectiveChildStatus }[];
  fee: number | null;
  feeHistory: { from: MonthKey; amount: number; currency?: Currency }[];
  dueDay: number;
  notes?: ChildNote[];
  verification?: string;
  archived?: boolean;
  archivedAt?: string | null;
}

export interface PaymentTender {
  method: string;
  amount: number;
}

export interface PaymentAllocation {
  month: MonthKey;
  amount: number;
}

export interface Payment {
  id: string;
  date: DateKey;
  /** Șir gol cât timp achitarea nu este asociată unui copil. */
  childId: string;
  childName?: string;
  sourceName?: string;
  sourceChildId?: string;
  group?: string;
  /** 44b: comun tuturor achitărilor dintr-o singură plată „+ Adaugă fratele" — un rând per copil,
   * un singur bon (§11.2, COMPONENTE.md). Absent pentru o achitare obișnuită, fără frați. */
  receiptGroupId?: string;
  month: MonthKey | '';
  method: string;
  /** Id dintr-un `Service` (B3, ALINIERE-DESIGN.md) — implicit 'gradinita', vezi normalizeRecord(). */
  service: string;
  tenders?: PaymentTender[];
  amount: number;
  /** Implicit 'MDL' dacă lipsește — vezi normalizeRecord(). */
  currency?: Currency;
  /** Curs BNM (MDL per 1 EUR) din ziua plății, doar când taxa copilului la acea dată era EUR — îngheață la salvare. */
  fxRate?: number;
  /** Proveniența lui fxRate — 'manual' se marchează portocaliu în raport/confirmare. Doar când fxRate există. */
  fxRateSource?: 'bnm' | 'manual';
  /** amount (lei) convertit la fxRate, rotunjit la ban — doar când fxRate există. */
  amountEur?: number;
  /** Numărul confirmării de plată (16b) — asignat o singură dată, la prima tipărire, din kindergarten.nextReceiptNumber. */
  receiptNumber?: number;
  /** Diferența de rotunjire (§9.1, F9): sumă încasată minus suma datorată, când diferența e sub
   * toleranța filialei — nu e restanță, nu e avans. Apare doar pe confirmarea de plată. */
  roundingDiff?: number;
  allocations: PaymentAllocation[];
  type?: string;
  notes?: string;
  verification?: string;
  original?: string;
  reviewed?: boolean;
  importSource?: Record<string, unknown>;
  archived?: boolean;
  archivedAt?: string | null;
}

export interface Expense {
  id: string;
  date: DateKey;
  category: string;
  method?: 'cash' | 'card' | 'transfer';
  description: string;
  amount: number;
  notes?: string;
  importSource?: Record<string, unknown>;
  archived?: boolean;
  archivedAt?: string | null;
}

export type GroupTeamRole = 'principal' | 'asistent' | 'inlocuitor';

export interface GroupTeamMember {
  staffId: string;
  role: GroupTeamRole;
  /** 1=luni … 5=vineri; absent = toate zilele lucrătoare. */
  days?: number[];
}

export interface Group {
  id: string;
  name: string;
  capacity: number | null;
  educator?: string;
  /** Personal 24 — un singur „principal”; staff-ul trăiește în baza comună, nu aici. */
  team?: GroupTeamMember[];
  /** Poziția grupei în Tablă/Carduri (03-grupe.md §3b). Lipsă = ordinea alfabetică curentă (fallback la citire). */
  order?: number;
  /** Una din cele 8 chei de ton din 03-grupe.md §3/§5b.2. Lipsă = calculată din poziția alfabetică (fallback). */
  tone?: string;
  /** Vârstă țintă în ani (03-grupe.md §5b.4), opțională — folosită pentru sugestii de copii. */
  ageMinYears?: number;
  ageMaxYears?: number;
}

export interface ExpenseCategory {
  id: string;
  name: string;
}

export type VisitStatus = 'Programată' | 'Efectuată' | 'Neprezentată' | 'Înscris' | 'Renunțat';

export interface VisitHistoryEntry {
  /** ISO */
  at: string;
  status: VisitStatus;
  date: DateKey;
  /** HH:MM */
  time: string;
}

export interface Visit {
  id: string;
  name: string;
  birthDate?: DateKey;
  parent: string;
  phone?: string;
  parent2?: string;
  phone2?: string;
  date: DateKey;
  /** HH:MM */
  time: string;
  status: VisitStatus;
  /** ISO; scris de client la schimbarea statutului, de server la înscriere și la expirare. */
  statusChangedAt: string;
  history: VisitHistoryEntry[];
  desiredStartDate?: DateKey;
  desiredGroupId: string | null;
  source?: string;
  /** Sensibil (SENSITIVE_FIELDS): exclus din export, redactat în istoric, golit la 12 luni de la statusChangedAt. */
  healthNotes?: string;
  postVisitNotes?: string;
  notes?: string;
  /** Obligatoriu ne-gol doar când status === 'Înscris'; interzis altfel. */
  childId: string;
  archived?: boolean;
  archivedAt?: string | null;
}

/** O taxă suplimentară a lunii (Bazin 23) — linie separată în obligation(), nu o mutație a copilului. */
export interface Charge {
  id: string;
  childId: string;
  month: MonthKey;
  kind: 'bazin';
  /** Text gata de afișat, scris de modulul care generează taxa (ex. „Bazin august: 6 × 150 lei”). */
  label: string;
  amount: number;
  currency: Currency;
  date: DateKey;
}

/** Un serviciu pe care se poate face o achitare (B3, ALINIERE-DESIGN.md) — Grădiniță și Bazin
 * sunt `system: true` (id fix, nu se șterg/redenumesc id-ul — taxa lunară și Bazinul depind de
 * ele); restul sunt servicii libere, adăugate din Backup și setări → Servicii (10d). */
export interface Service {
  id: string;
  name: string;
  /** Poziția în listă (10d) — lipsă = ordinea de creare (fallback la citire, ca la Group.order). */
  order?: number;
  /** Una din cele 8 chei de ton (ca Group.tone) — culoarea pastilei serviciului. */
  tone: string;
  priceMode: 'free' | 'fixed';
  /** Doar când priceMode === 'fixed'. */
  price?: number;
  /** Ascuns = nu mai apare în Achitare nouă, rămâne în filtre și în istoricul plăților existente. */
  hidden?: boolean;
  /** Grădiniță/Bazin — nu se șterg, id-ul nu se schimbă (taxa/Bazinul depind de el). */
  system: boolean;
}

/** Un plătitor reținut (Asociere achitări, 11-de-rezolvat.md §9c / fișa copilului, 09-copii-fisa.md
 * — decizia 25 sept. 2026): leagă textul plătitorului din extrasul bancar de un copil, ca sugestia
 * să apară primă, cu motivul „Plătitor reținut”, la următoarea achitare de la același plătitor. */
export interface PayerAlias {
  id: string;
  /** Text brut al plătitorului, cum a apărut în `payment.sourceName` la salvare. */
  alias: string;
  childId: string;
  /** ISO */
  createdAt: string;
}

export interface RecordsSnapshot {
  children: Child[];
  payments: Payment[];
  expenses: Expense[];
  groups: Group[];
  categories: ExpenseCategory[];
  visits: Visit[];
  /** Opțional în tipul TS (fixturile vechi de test nu-l declară); serverul îl trimite mereu ca listă reală. */
  charges?: Charge[];
  /** Opțional în tipul TS, din același motiv ca `charges`. */
  payerAliases?: PayerAlias[];
  /** Opțional în tipul TS, din același motiv ca `charges`; serverul îl trimite mereu, seedat cu Grădiniță+Bazin. */
  services?: Service[];
}

export interface RecordByType {
  children: Child;
  payments: Payment;
  expenses: Expense;
  groups: Group;
  categories: ExpenseCategory;
  visits: Visit;
  charges: Charge;
  payerAliases: PayerAlias;
  services: Service;
}
