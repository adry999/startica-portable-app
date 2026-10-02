import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@shared/api/session';
import type { AuditEntry, AuditPage } from '#features/audit-log/audit-log.types.d.mts';
import type { AuditActionTone, AuditLogStatus } from './useAuditLog';

/**
 * Etichete Ro pentru modulele canonice (computer-profile.mjs `MODULE_IDS`) — o copie minimală,
 * doar pentru afișare pe fila „Acces” (36g). `nav-items.ts` (§2, stratul client de profiluri)
 * va avea propria hartă completă, cu aceleași chei — dacă diverg, aceasta se aliniază la ea
 * (vezi INTREBARI.md, nu e o sursă de adevăr, doar o comoditate de afișare aici).
 */
const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Panou',
  children: 'Copii',
  groups: 'Grupe',
  attendance: 'Prezență',
  visits: 'Vizite',
  personal: 'Personal',
  pool: 'Bazin',
  payments: 'Achitări',
  expenses: 'Cheltuieli',
  status: 'Situația',
  notify: 'De notificat',
  report: 'Raport',
  resolve: 'De rezolvat',
  admin: 'Administrare',
};

function moduleLabel(recordId: string | null): string {
  if (!recordId) return '';
  return recordId
    .split(',')
    .map(id => MODULE_LABELS[id] ?? id)
    .join(', ');
}

export interface AccessRowView {
  id: number;
  dayKey: string;
  dayLabel: string;
  timeLabel: string;
  actionLabel: string;
  actionTone: AuditActionTone;
  moduleLabel: string;
  deviceName: string;
}

export interface AccessLogData {
  status: AuditLogStatus;
  failureMessage: string;
  rows: AccessRowView[];
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
}

/** @param {string} action „access.pin_ok” / „access.pin_fail” / „access.blocked” / „access.locked”. */
function describeAccessAction(action: string): { label: string; tone: AuditActionTone } {
  if (action === 'access.pin_ok') return { label: 'PIN corect', tone: 'mint' };
  if (action === 'access.pin_fail') return { label: 'PIN greșit', tone: 'yellow' };
  if (action === 'access.locked') return { label: 'Blocat (5 greșeli)', tone: 'pink' };
  if (action === 'access.blocked') return { label: 'Acces respins', tone: 'pink' };
  return { label: action, tone: 'neutral' };
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

function toAccessRow(entry: AuditEntry): AccessRowView {
  const { label: actionLabel, tone: actionTone } = describeAccessAction(entry.action);
  const occurredAt = new Date(entry.occurredAt);
  return {
    id: entry.id,
    dayKey: dayKeyOf(occurredAt),
    dayLabel: dayLabelOf(occurredAt),
    timeLabel: occurredAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
    actionLabel,
    actionTone,
    moduleLabel: moduleLabel(entry.recordId),
    deviceName: entry.deviceName || 'Acest calculator',
  };
}

function pathFor(beforeEntryId: number | null): string {
  return beforeEntryId === null ? '/api/audit/access' : `/api/audit/access?beforeEntryId=${beforeEntryId}`;
}

/**
 * Fila „Acces” (§7, 36g) — evenimentele `access.*` (PIN, gărzi de profil), separate de restul
 * istoricului (`useAuditLog`). Doar profilul Complet le vede (server: `/api/audit/access` e pe
 * modulul `admin`) — un profil restrâns primește 403, tratat ca `failed` mai jos, la fel ca orice
 * altă cerere fără acces.
 */
export function useAccessLog(): AccessLogData {
  const [rows, setRows] = useState<AccessRowView[]>([]);
  const [status, setStatus] = useState<AuditLogStatus>('loading');
  const [failureMessage, setFailureMessage] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const nextBeforeEntryId = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setFailureMessage('');
    requestJson(pathFor(null))
      .then(response => {
        if (cancelled) return;
        const page = response as AuditPage;
        nextBeforeEntryId.current = page.nextBeforeEntryId;
        setRows(page.entries.map(toAccessRow));
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
    requestJson(pathFor(nextBeforeEntryId.current))
      .then(response => {
        const page = response as AuditPage;
        nextBeforeEntryId.current = page.nextBeforeEntryId;
        setRows(previous => [...previous, ...page.entries.map(toAccessRow)]);
        setHasMore(page.nextBeforeEntryId !== null);
        setIsLoadingMore(false);
      })
      .catch((error: Error) => {
        setIsLoadingMore(false);
        setFailureMessage(error.message);
      });
  }

  return { status, failureMessage, rows, hasMore, isLoadingMore, loadMore };
}
