import type {
  RecordRepository,
  RevisionEnvelope,
  RevisionRequest,
  RunRevisionTransaction,
} from '#shared/contracts/persistence.mjs';
import type { AuditTrail } from '#shared/contracts/audit-trail.mjs';

/** Contractul HTTP existent al /api/visits-enrol. */
export interface EnrolChildRequest extends RevisionRequest {
  visitId: string;
  /** Fișa completată în editorul precompletat; validată/normalizată de serviciu. */
  child: unknown;
}

export type EnrolChildResult = RevisionEnvelope & { childId: string };

export interface ExpireHealthNotesResult {
  expired: number;
}

export interface VisitsServiceDependencies {
  /** Are nevoie și de `currentRevision()`, folosit de măturarea de la pornire pt. cererea sintetică. */
  recordRepository: RecordRepository & { currentRevision(): number };
  auditTrail: AuditTrail;
  runRevisionTransaction: RunRevisionTransaction;
}

export interface VisitsService {
  enrolChild(input: { visitId: string; child: unknown }, request: RevisionRequest): EnrolChildResult;
  expireHealthNotes(todayStr?: string): ExpireHealthNotesResult;
}

export interface VisitsRoutesDependencies {
  visitsService: Pick<VisitsService, 'enrolChild'>;
}
