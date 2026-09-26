export type RecordType = 'children' | 'payments' | 'expenses' | 'groups' | 'categories' | 'visits';

/** YYYY-MM */
export type MonthKey = string;
/** YYYY-MM-DD */
export type DateKey = string;

export type ChildStatus = 'Activ' | 'Suspendat' | 'Retras' | 'De verificat';
export type EffectiveChildStatus = Exclude<ChildStatus, 'De verificat'>;

export type Currency = 'MDL' | 'EUR';

export interface Child {
  id: string;
  name: string;
  contractNumber?: string;
  parent: string;
  phone: string;
  parent2?: string;
  phone2?: string;
  /** Sensibil (SENSITIVE_FIELDS): exclus din export, redactat în istoric, golit la 12 luni de la archivedAt. */
  healthNotes?: string;
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
  notes?: string;
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
  /** amount (lei) convertit la fxRate, rotunjit la ban — doar când fxRate există. */
  amountEur?: number;
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

export interface Group {
  id: string;
  name: string;
  capacity: number | null;
  educator?: string;
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

export interface RecordsSnapshot {
  children: Child[];
  payments: Payment[];
  expenses: Expense[];
  groups: Group[];
  categories: ExpenseCategory[];
  visits: Visit[];
}

export interface RecordByType {
  children: Child;
  payments: Payment;
  expenses: Expense;
  groups: Group;
  categories: ExpenseCategory;
  visits: Visit;
}
