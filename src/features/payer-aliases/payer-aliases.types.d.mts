import type { RecordRepository, RevisionRequest, RunRevisionTransaction } from '#shared/contracts/persistence.mjs';
import type { AuditTrail } from '#shared/contracts/audit-trail.mjs';

/** Contractul HTTP al /api/payer-alias-delete. */
export interface PayerAliasDeleteRequest extends RevisionRequest {
  id: string;
}

export interface PayerAliasesRoutesDependencies {
  recordRepository: RecordRepository;
  auditTrail: AuditTrail;
  runRevisionTransaction: RunRevisionTransaction;
}
