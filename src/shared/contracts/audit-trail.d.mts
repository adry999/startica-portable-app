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
  // Întoarce id-ul intrării create — folosit de 40b (UndoToast) ca să ceară POST /api/undo;
  // dublele de test (recording-audit-trail.mjs) întorc undefined, ceea ce e un auditId absent valid.
  recordChange(change: AuditChange): number | undefined;
}
