import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@shared/api/session';
import type { RecordType } from '@contracts/record-types.mjs';
import { listChangedFields } from '#features/audit-log/domain/audit-change-diff.mjs';
import type { AuditEntry, AuditPage } from '#features/audit-log/audit-log.types.d.mts';

export type AuditLogStatus = 'loading' | 'ready' | 'empty' | 'failed';

/** Aceleași tonuri ca `BadgeTone` din shared/ui — hook-ul nu importă componenta, doar forma. */
export type AuditActionTone = 'orange' | 'mint' | 'yellow' | 'pink' | 'neutral';

export interface AuditChangeView {
  field: string;
  beforeLabel: string;
  afterLabel: string;
}

export interface AuditRowView {
  id: number;
  /** Cheie de grupare pe zi calendaristică locală (nu ISO), stabilă indiferent de fus. */
  dayKey: string;
  /** „Azi · 26 septembrie” / „Ieri · …” / „26 septembrie” (12-administrare.md §10a). */
  dayLabel: string;
  timeLabel: string;
  recordType: RecordType | null;
  actionLabel: string;
  actionTone: AuditActionTone;
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

/**
 * Cele 5 etichete din spec (12-administrare.md §10a). Acțiunile din server sunt texte libere
 * (`adăugare`, `arhivare`, `asociere achitare`, `ștergere avans`, `import-istoric`, `plată salarii`…),
 * nu un enum — [decizie]: orice acțiune care nu se potrivește clar cade pe „Modificat” (yellow),
 * cea mai neutră dintre cele cinci.
 */
function describeAuditAction(action: string): { label: string; tone: AuditActionTone } {
  const normalized = action.toLowerCase();
  if (normalized.includes('ștergere')) return { label: 'Șters', tone: 'pink' };
  if (normalized.includes('arhivare')) return { label: 'Arhivat', tone: 'neutral' };
  if (normalized.includes('asociere')) return { label: 'Asociat', tone: 'orange' };
  if (normalized.includes('adăugare') || normalized.includes('import')) return { label: 'Creat', tone: 'mint' };
  return { label: 'Modificat', tone: 'yellow' };
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabelOf(date: Date): string {
  const label = date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' });
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return `Azi · ${label}`;
  if (diffDays === 1) return `Ieri · ${label}`;
  return label;
}

function toRow(entry: AuditEntry): AuditRowView {
  const { label: actionLabel, tone: actionTone } = describeAuditAction(entry.action);
  const occurredAt = new Date(entry.occurredAt);
  return {
    id: entry.id,
    dayKey: dayKeyOf(occurredAt),
    dayLabel: dayLabelOf(occurredAt),
    timeLabel: occurredAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
    recordType: entry.recordType,
    actionLabel,
    actionTone,
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
 * Gruparea pe zile și filtrarea (căutare + tip) se fac în `AuditLogPage`, pe rândurile deja încărcate.
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
