import type { RecordType } from './record-types.mjs';

export interface AuditChange {
  action: string;
  recordType?: RecordType | null;
  recordId?: string | null;
  before?: unknown;
  after?: unknown;
  occurredAt?: Date;
}

/** Port implementat de audit-log și injectat de composition root în feature-urile care scriu date. */
export interface AuditTrail {
  recordChange(change: AuditChange): void;
}
