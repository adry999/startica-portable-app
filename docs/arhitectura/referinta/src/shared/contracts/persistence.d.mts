import type { RecordByType, RecordType, RecordsSnapshot } from './record-types.mjs';

export interface RecordRepository {
  find<Type extends RecordType>(type: Type, id: string): RecordByType[Type] | undefined;
  exists(type: RecordType, id: string): boolean;
  save<Type extends RecordType>(type: Type, record: RecordByType[Type]): void;
  remove(type: RecordType, id: string): void;
  readSnapshot(): RecordsSnapshot;
}

/** Orice scriere poartă revizia văzută de client și un id unic, pentru idempotență la reluare. */
export interface RevisionRequest {
  revision: number;
  requestId: string;
}

export interface RevisionTransactionOptions {
  action: string;
  backupBefore?: boolean;
}

export interface RevisionEnvelope {
  ok: true;
  state: RecordsSnapshot;
  revision: number;
  updatedAt: string;
  replayed?: true;
  warning?: string;
}

export type RunRevisionTransaction = (
  request: RevisionRequest,
  options: RevisionTransactionOptions,
  applyChanges: () => void,
) => RevisionEnvelope;
