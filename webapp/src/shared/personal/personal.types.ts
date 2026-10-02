/**
 * Tipuri pentru modulul Personal (24), portate 1:1 din `src/features/personal/personal.types.d.mts`
 * (backend, .mjs) — vezi docs/superpowers/plans/2026-09-27-personal-bazin.md.
 *
 * De înlocuit cu import direct din `#features/personal/index.web.mjs` de îndată ce acel fișier
 * apare (Task 3 din plan) — până atunci webapp-ul nu poate importa direct din interiorul unui
 * feature de backend, așa că tipurile și regulile pure sunt duplicate aici, izolat.
 */

// 'P' (prezent, §9.2/41b): confirmare explicită scrisă doar de completarea rapidă pe
// săptămână (WeekFillBar) — numărată identic cu lipsa rândului, vezi timesheet-rules.ts.
export type TimesheetCode = 'CO' | 'CM' | 'A' | 'I' | 'FP' | 'P';
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
  /** id-uri din registrul filialelor — una sau ambele. */
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
  expenseId: string;
  deductedAt?: string | null;
  deductedBy?: string | null;
}

export interface SalaryPayment {
  id: string;
  staffId: string;
  month: string;
  branchId: string;
  mode: SalaryMode;
  amount: number;
  advances: string[];
  paidAt: string;
}

export interface PersonalSettings {
  annualLeaveDays: number;
  deductOnlyUnexcused: boolean;
}

/** 23l Candidați — listă simplă, comună ambelor filiale, fără legare de `Staff`. */
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
  workingDays: number;
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

// `group_staff` din spec (24-personal.md) — echipa unei grupe. Tipul e cel real, `GroupTeamMember`
// din `@contracts/record-types.mjs` (`Group.team`); nu se mai duplică aici.

/** Un rând din `GET /api/personal/salaries?month=`. */
export interface SalaryRow {
  staff: Staff;
  /** null = angajatul nu are încă niciun salariu setat pentru lună (23c: „+ Setează salariul”). */
  mode: SalaryMode | null;
  base: string;
  gross: number | null;
  advances: number;
  net: number | null;
  paid: { branchId: string; paidAt: string } | null;
  /** Luna nu s-a încheiat — suma nu e definitivă (M4, audit B). */
  estimated: boolean;
}

/** Un rând din `GET /api/personal/salaries/history?staffId=` — forma reală a lui `salaries.service.mjs#history`. */
export interface SalaryHistoryMonth {
  month: string;
  payment: SalaryPayment | null;
  advances: Advance[];
}
