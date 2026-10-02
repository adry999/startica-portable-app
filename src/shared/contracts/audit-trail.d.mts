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
  // §7 (36g): scrie o intrare venită de pe alt calculator (change-applier.mjs, pull-ul de
  // sincronizare) — opțional, doar `createAuditLogRepository` îl implementează; dublele de test
  // (recording-audit-trail.mjs) nu au nimic de aplicat din altă parte.
  mergeSyncedEntry?(entry: {
    entryUid: string;
    deviceId: string;
    deviceName: string;
    action: string;
    recordType: RecordType | null;
    recordId: string | null;
    before: unknown;
    after: unknown;
    occurredAt: string;
  }): void;
}
