import { useCallback, useEffect, useMemo, useState } from 'react';
import { requestJson } from '@shared/api/session';
import { shiftDays, today as todayFn } from '@domain/calendar-month.mjs';
import type { SmsLogEntryView, SmsLogPageView, SmsMonthlyBreakdownView } from './sms-types';

export type SmsLogSegment = 'all' | 'delivered' | 'inProgress' | 'failed';
/** null = „Toate lunile” (fără cutoff), altfel numărul de zile din „Perioadă ▾". */
export type SmsLogPeriodDays = 7 | 30 | 90 | null;
export type SmsLogScreenStatus = 'loading' | 'ready' | 'failed';

export interface SmsLogTemplateOption {
  id: string;
  name: string;
}

export interface SmsLogData {
  status: SmsLogScreenStatus;
  failureMessage: string;
  entries: SmsLogEntryView[];
  stats: SmsLogPageView['stats'];
  monthly: SmsMonthlyBreakdownView[];
  period: SmsLogPeriodDays;
  setPeriod: (period: SmsLogPeriodDays) => void;
  segment: SmsLogSegment;
  setSegment: (segment: SmsLogSegment) => void;
  segmentCounts: Record<SmsLogSegment, number>;
  templateId: string | null;
  setTemplateId: (id: string | null) => void;
  templateOptions: SmsLogTemplateOption[];
  search: string;
  setSearch: (text: string) => void;
  refresh: () => Promise<void>;
}

// Foarte veche: echivalentul „fără cutoff” pentru API-ul care cere mereu un `after` valid.
const ALL_PERIOD_AFTER = '1900-01-01';

const EMPTY_STATS: SmsLogPageView['stats'] = {
  sentThisMonth: 0,
  failedThisMonth: 0,
  segmentsThisMonth: 0,
  monthlyLimit: null,
};

function afterParamFor(periodDays: SmsLogPeriodDays): string {
  return periodDays === null ? ALL_PERIOD_AFTER : shiftDays(todayFn(), -periodDays);
}

// „Necunoscut" (RASPUNSURI 7) se filtrează sub „Eșuate” — mockup-ul 11a nu are un al patrulea
// segment, iar un rând fără răspuns terminal e tot un rând pe care operatorul îl poate retrimite.
function matchesSegment(entry: SmsLogEntryView, segment: SmsLogSegment): boolean {
  if (segment === 'all') return true;
  if (segment === 'delivered') return entry.status === 'delivered';
  if (segment === 'inProgress') return entry.status === 'sent';
  return entry.status === 'failed' || entry.status === 'unknown';
}

function matchesSearch(entry: SmsLogEntryView, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return (
    entry.recipientName.toLowerCase().includes(needle) ||
    entry.childName.toLowerCase().includes(needle) ||
    entry.phone.toLowerCase().includes(needle)
  );
}

/**
 * Fila „Mesaje SMS" (11a): `GET /api/sms-log` pe perioadă + o reîmprospătare a stărilor de livrare
 * la montare; filtrele de stare/șablon/căutare rămân locale (spec §8).
 */
export function useSmsLog(): SmsLogData {
  const [status, setStatus] = useState<SmsLogScreenStatus>('loading');
  const [failureMessage, setFailureMessage] = useState('');
  const [page, setPage] = useState<SmsLogPageView | null>(null);
  const [period, setPeriod] = useState<SmsLogPeriodDays>(30);
  const [segment, setSegment] = useState<SmsLogSegment>('all');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async (periodDays: SmsLogPeriodDays) => {
    const response = (await requestJson(`/api/sms-log?after=${afterParamFor(periodDays)}`)) as SmsLogPageView;
    setPage(response);
    setStatus('ready');
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setFailureMessage('');
    load(period).catch((error: Error) => {
      if (cancelled) return;
      setStatus('failed');
      setFailureMessage(error.message);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    // O singură reîmprospătare la deschiderea filei, nu la fiecare schimbare de perioadă —
    // altfel operatorul interoghează sms.md doar pentru a schimba filtrul de zile.
    requestJson('/api/sms-refresh-statuses', {})
      .then(() => load(period))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entries = page?.entries ?? [];

  const templateOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const entry of entries) if (entry.templateId) byId.set(entry.templateId, entry.templateName);
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [entries]);

  const segmentCounts = useMemo(() => {
    const counts: Record<SmsLogSegment, number> = { all: entries.length, delivered: 0, inProgress: 0, failed: 0 };
    for (const entry of entries) {
      if (entry.status === 'delivered') counts.delivered += 1;
      else if (entry.status === 'sent') counts.inProgress += 1;
      else counts.failed += 1;
    }
    return counts;
  }, [entries]);

  const filteredEntries = useMemo(
    () =>
      entries.filter(
        entry =>
          matchesSegment(entry, segment) &&
          (templateId === null || entry.templateId === templateId) &&
          matchesSearch(entry, search),
      ),
    [entries, segment, templateId, search],
  );

  return {
    status,
    failureMessage,
    entries: filteredEntries,
    stats: page?.stats ?? EMPTY_STATS,
    monthly: page?.monthly ?? [],
    period,
    setPeriod,
    segment,
    setSegment,
    segmentCounts,
    templateId,
    setTemplateId,
    templateOptions,
    search,
    setSearch,
    refresh: () => load(period),
  };
}
