export type RecordType = 'children' | 'payments' | 'expenses' | 'groups' | 'categories' | 'visits' | 'charges';

/** YYYY-MM */
export type MonthKey = string;
/** YYYY-MM-DD */
export type DateKey = string;

export type ChildStatus = 'Activ' | 'Suspendat' | 'Retras' | 'De verificat';
export type EffectiveChildStatus = Exclude<ChildStatus, 'De verificat'>;

export type Currency = 'MDL' | 'EUR';

/** O notă din fișa copilului (CF-4, 09-copii-fisa.md) — listă, nu text liber, ca fiecare
 * intrare să-și păstreze data la care a fost scrisă. */
export interface ChildNote {
  id: string;
  text: string;
  date: DateKey;
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
  parent2?: string;
  phone2?: string;
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
  month: MonthKey | '';
  method: string;
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

export interface RecordsSnapshot {
  children: Child[];
  payments: Payment[];
  expenses: Expense[];
  groups: Group[];
  categories: ExpenseCategory[];
  visits: Visit[];
  /** Opțional în tipul TS (fixturile vechi de test nu-l declară); serverul îl trimite mereu ca listă reală. */
  charges?: Charge[];
}

export interface RecordByType {
  children: Child;
  payments: Payment;
  expenses: Expense;
  groups: Group;
  categories: ExpenseCategory;
  visits: Visit;
  charges: Charge;
}
