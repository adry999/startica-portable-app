import type { RecordType } from '#shared/contracts/record-types.mjs';

export type { AuditChange, AuditTrail } from '#shared/contracts/audit-trail.mjs';

export interface AuditEntry {
  id: number;
  occurredAt: string;
  action: string;
  recordType: RecordType | null;
  recordId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface AuditPage {
  entries: AuditEntry[];
  nextBeforeEntryId: number | null;
}

export interface AuditFieldChange {
  field: string;
  before: unknown;
  after: unknown;
}
