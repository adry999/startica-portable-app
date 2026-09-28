export type TimesheetCode = 'CO' | 'CM' | 'A' | 'I' | 'FP';
export type LeaveType = 'CO' | 'CM' | 'FP';
export type SalaryMode = 'fix' | 'zi' | 'bazin';

export interface Department {
  id: string;
  name: string;
  order: number;
}

export interface Role {
  id: string;
  name: string;
  departmentId: string;
  order: number;
}

export interface StaffNote {
  at: string;
  text: string;
}

export interface Staff {
  id: string;
  name: string;
  roleId: string;
  /** id-uri din registrul filialelor (filiale.json) — una sau ambele. */
  branchIds: string[];
  phone: string;
  birth?: string;
  idnp?: string;
  address?: string;
  since: string;
  archivedAt?: string | null;
  notes: StaffNote[];
}

export interface TimesheetRow {
  id: string;
  staffId: string;
  date: string;
  code: TimesheetCode;
  leaveId?: string;
}

export interface Leave {
  id: string;
  staffId: string;
  from: string;
  to: string;
  type: LeaveType;
  planned: boolean;
  note?: string;
}

export interface Salary {
  id: string;
  staffId: string;
  mode: SalaryMode;
  amount: number;
  validFrom: string;
}

export interface Advance {
  id: string;
  staffId: string;
  date: string;
  amount: number;
  method: string;
  month: string;
  deductedAt?: string | null;
  /** id-ul lui salary_payments care a scăzut avansul, prima dată — vezi decizia 6. */
  deductedBy?: string | null;
  expenseId: string;
}

export interface SalaryPayment {
  id: string;
  staffId: string;
  month: string;
  branchId: string;
  mode: SalaryMode;
  amount: number;
  advances: string[];
  expenseId: string;
  paidAt: string;
}

export interface PersonalSettings {
  annualLeaveDays: number;
  deductOnlyUnexcused: boolean;
}

/** 23l Candidați — listă simplă, comună ambelor filiale, fără legare de `staff`. */
export interface Candidate {
  id: string;
  name: string;
  position: string;
  age: number | null;
  experience: string;
  city: string;
  phone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimesheetCell {
  date: string;
  kind: 'off' | 'none' | 'future' | '' | TimesheetCode;
}

export interface TimesheetMonthSummary {
  staffId: string;
  cells: TimesheetCell[];
  worked: number;
  hours: number;
  co: number;
  cm: number;
  a: number;
  i: number;
  fp: number;
  /** Zilele lucrătoare din perioada activă a angajatului (folosite pentru contoare). */
  workingDays: number;
  /** Zilele lucrătoare ale întregii luni calendaristice — pentru salariul pro-rata (M3). */
  workingDaysInMonth: number;
}

export interface LeaveDaysRemaining {
  used: number;
  planned: number;
  remaining: number;
}

export interface OverlappingLeaveWarning {
  groupId: string;
  staffIds: string[];
  from: string;
  to: string;
}
