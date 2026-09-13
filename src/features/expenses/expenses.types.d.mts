import type { RecordRepository, RevisionRequest, RunRevisionTransaction } from '#shared/contracts/persistence.mjs';
import type { AuditTrail } from '#shared/contracts/audit-trail.mjs';
import type { RecordsSnapshot } from '#shared/contracts/record-types.mjs';

/** Contractul HTTP existent al /api/category-delete; se păstrează neschimbat la migrare. */
export interface CategoryDeleteRequest extends RevisionRequest {
  id: string;
}

export interface ExpenseCategoriesRoutesDependencies {
  recordRepository: RecordRepository;
  auditTrail: AuditTrail;
  runRevisionTransaction: RunRevisionTransaction;
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
