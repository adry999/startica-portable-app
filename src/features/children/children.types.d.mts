import type { Child } from '#shared/contracts/record-types.mjs';

export interface ChildrenCsvPreviewRow {
  line: number;
  id: string;
  name: string;
  contractNumber: string;
  parent: string;
  phone: string;
  parent2: string;
  phone2: string;
  birthDate: string;
  attendanceDate: string;
  action: string;
  reason: string;
  warnings: string[];
}

export interface ChildrenCsvPreviewReport {
  total: number;
  additions: Child[];
  rows: ChildrenCsvPreviewRow[];
  errors: string[];
  warnings: string[];
  skipped: number;
  conflicts: number;
  /** Doar în răspunsul rutei de previzualizare; importul confirmat o trimite înapoi. */
  revision?: number;
}
