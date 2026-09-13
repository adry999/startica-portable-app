export type RecordType = 'children' | 'payments' | 'expenses' | 'groups' | 'categories';

/** YYYY-MM */
export type MonthKey = string;
/** YYYY-MM-DD */
export type DateKey = string;

export type ChildStatus = 'Activ' | 'Suspendat' | 'Retras' | 'De verificat';
export type EffectiveChildStatus = Exclude<ChildStatus, 'De verificat'>;

export interface Child {
  id: string;
  name: string;
  contractNumber?: string;
  parent: string;
  phone: string;
  parent2?: string;
  phone2?: string;
  birthDate?: DateKey;
  contractDate?: DateKey;
  attendanceDate?: DateKey;
  withdrawalDate?: DateKey;
  groupId: string | null;
  status: ChildStatus;
  statusHistory: { from: MonthKey; status: EffectiveChildStatus }[];
  fee: number | null;
  feeHistory: { from: MonthKey; amount: number }[];
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

export interface RecordsSnapshot {
  children: Child[];
  payments: Payment[];
  expenses: Expense[];
  groups: Group[];
  categories: ExpenseCategory[];
}

export interface RecordByType {
  children: Child;
  payments: Payment;
  expenses: Expense;
  groups: Group;
  categories: ExpenseCategory;
}
