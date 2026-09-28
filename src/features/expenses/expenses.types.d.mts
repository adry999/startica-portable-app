import type { RecordRepository, RevisionRequest, RunRevisionTransaction } from '#shared/contracts/persistence.mjs';
import type { AuditTrail } from '#shared/contracts/audit-trail.mjs';
import type { RecordsSnapshot } from '#shared/contracts/record-types.mjs';

/** Contractul HTTP existent al /api/category-delete; se păstrează neschimbat la migrare. */
export interface CategoryDeleteRequest extends RevisionRequest {
  id: string;
}

/** /api/category-rename: redenumire atomică, cu propagare la cheltuielile categoriei. */
export interface CategoryRenameRequest extends RevisionRequest {
  id: string;
  name: string;
}

export interface ExpenseCategoriesRoutesDependencies {
  recordRepository: RecordRepository;
  auditTrail: AuditTrail;
  runRevisionTransaction: RunRevisionTransaction;
  // Pentru semințe (B-1 din audit): scriu brut, fără outbox — vezi expense-category-seeding.mjs.
  rawRecordRepository: RecordRepository;
  database: import('node:sqlite').DatabaseSync;
}

export interface ExpenseCategoriesControllerElements {
  chips: HTMLElement;
  createForm: HTMLFormElement;
  nameInput: HTMLInputElement;
  categoryFilter: HTMLSelectElement;
}

export interface ExpenseCategoriesControllerDependencies {
  elements: ExpenseCategoriesControllerElements;
  readRecords: () => RecordsSnapshot;
  submitMutation: (path: string, body: unknown) => Promise<unknown>;
  showNotice: (message: string, isError?: boolean) => void;
}
