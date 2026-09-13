import type { MonthKey, Payment, RecordsSnapshot } from '#shared/contracts/record-types.mjs';
import type { AuditTrail } from '#shared/contracts/audit-trail.mjs';
import type { RecordRepository, RevisionRequest, RunRevisionTransaction } from '#shared/contracts/persistence.mjs';
import type { DomainEventBus } from '#shared/contracts/domain-event-payloads.mjs';

/** Contractul HTTP existent al /api/payments-assign; se păstrează neschimbat la migrare. */
export interface PaymentAssignmentWire {
  id: string;
  childId: string;
}

export interface AssignPaymentsRequest extends RevisionRequest {
  assignments: PaymentAssignmentWire[];
}

export interface ChildSuggestion {
  id: string;
  name: string;
  contractNumber?: string;
  score: number;
  /** Doar potrivirea de nume indică un copil anume; suma și luna se potrivesc la mulți copii. */
  nameMatch: boolean;
  reasons: string[];
}

export interface AssignmentQueueEntry {
  payment: Payment;
  suggestions: ChildSuggestion[];
}

export interface AssignmentQueueRow extends AssignmentQueueEntry {
  selectedChildId: string;
}

export interface AssignmentRisk {
  unassigned: number;
  coveringMonth: number;
  amountCoveringMonth: number;
  notified: number;
}

export interface PaymentAssignmentScreenState {
  risk: AssignmentRisk;
  queue: AssignmentQueueRow[];
  selectedCount: number;
  isSaving: boolean;
  failure: { message: string; retryable: boolean } | null;
}

export interface PaymentAssignmentServiceDependencies {
  recordRepository: RecordRepository;
  auditTrail: AuditTrail;
  runRevisionTransaction: RunRevisionTransaction;
}

export interface PaymentAssignmentControllerDependencies {
  readRecords: () => RecordsSnapshot;
  readSelectedMonth: () => MonthKey;
  readToday: () => string;
  submitAssignments: (assignments: PaymentAssignmentWire[]) => Promise<unknown>;
  eventBus: DomainEventBus;
  renderAssignmentScreen: (state: PaymentAssignmentScreenState) => void;
  renderUnassignedCount: (count: number) => void;
}
