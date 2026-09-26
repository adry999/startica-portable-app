import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@shared/api/session';
import { listChangedFields } from '#features/audit-log/domain/audit-change-diff.mjs';
import { formatDateTime } from '#shared/format/date-format.mjs';
import type { AuditEntry, AuditPage } from '#features/audit-log/audit-log.types.d.mts';

export type AuditLogStatus = 'loading' | 'ready' | 'empty' | 'failed';

export interface AuditChangeView {
  field: string;
  beforeLabel: string;
  afterLabel: string;
}

export interface AuditRowView {
  id: number;
  occurredAtLabel: string;
  action: string;
  recordLabel: string;
  changes: AuditChangeView[];
}

export interface AuditLogData {
  status: AuditLogStatus;
  failureMessage: string;
  rows: AuditRowView[];
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
}

function toRow(entry: AuditEntry): AuditRowView {
  return {
    id: entry.id,
    occurredAtLabel: formatDateTime(entry.occurredAt),
    action: entry.action,
    recordLabel: entry.recordId ?? 'Setări',
    changes: listChangedFields(entry.before, entry.after).map(change => ({
      field: change.field,
      beforeLabel: JSON.stringify(change.before),
      afterLabel: JSON.stringify(change.after),
    })),
  };
}

/**
 * Încărcare pe pagini (`/api/audit`), cu `beforeEntryId` pentru continuare.
 * Fără sesiunea de records — istoricul vine direct din API, nu din `useAppSession()`.
 */
export function useAuditLog(): AuditLogData {
  const [rows, setRows] = useState<AuditRowView[]>([]);
  const [status, setStatus] = useState<AuditLogStatus>('loading');
  const [failureMessage, setFailureMessage] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const nextBeforeEntryId = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setFailureMessage('');
    requestJson('/api/audit')
      .then(response => {
        if (cancelled) return;
        const page = response as AuditPage;
        nextBeforeEntryId.current = page.nextBeforeEntryId;
        setRows(page.entries.map(toRow));
        setHasMore(page.nextBeforeEntryId !== null);
        setStatus(page.entries.length ? 'ready' : 'empty');
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setStatus('failed');
        setFailureMessage(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function loadMore() {
    if (status !== 'ready' || !hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    setFailureMessage('');
    const path =
      nextBeforeEntryId.current === null ? '/api/audit' : `/api/audit?beforeEntryId=${nextBeforeEntryId.current}`;
    requestJson(path)
      .then(response => {
        const page = response as AuditPage;
        nextBeforeEntryId.current = page.nextBeforeEntryId;
        setRows(previous => [...previous, ...page.entries.map(toRow)]);
        setHasMore(page.nextBeforeEntryId !== null);
        setIsLoadingMore(false);
      })
      .catch((error: Error) => {
        // Paginile deja afișate rămân; eșecul privește doar continuarea.
        setIsLoadingMore(false);
        setFailureMessage(error.message);
      });
  }

  return { status, failureMessage, rows, hasMore, isLoadingMore, loadMore };
}
