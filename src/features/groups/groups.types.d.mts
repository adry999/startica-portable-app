import type { RecordRepository, RevisionRequest, RunRevisionTransaction } from '#shared/contracts/persistence.mjs';
import type { AuditTrail } from '#shared/contracts/audit-trail.mjs';
import type { RecordsSnapshot } from '#shared/contracts/record-types.mjs';

/** Contractul HTTP existent al /api/group-delete; se păstrează neschimbat la migrare. */
export interface GroupDeleteRequest extends RevisionRequest {
  id: string;
}

export interface GroupsRoutesDependencies {
  recordRepository: RecordRepository;
  auditTrail: AuditTrail;
  runRevisionTransaction: RunRevisionTransaction;
}

export interface GroupsControllerElements {
  grid: HTMLElement;
  createForm: HTMLFormElement;
  nameInput: HTMLInputElement;
  capacityInput: HTMLInputElement;
}

export interface GroupsControllerDependencies {
  elements: GroupsControllerElements;
  readRecords: () => RecordsSnapshot;
  submitMutation: (path: string, body: unknown) => Promise<unknown>;
  showNotice: (message: string, isError?: boolean) => void;
}
