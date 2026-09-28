import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@shared/api/session';
import { isoDateOf } from '@domain/calendar-month.mjs';
import type { SmsLastNotifiedView } from './sms-types';

export interface SmsLastNotifiedData {
  byChild: Record<string, SmsLastNotifiedView>;
  refresh: () => Promise<void>;
  /** Compară doar data locală (nu ora), ca „Notificat azi" să nu depindă de fusul orar al serverului. */
  notifiedToday: (childId: string, todayStr: string) => boolean;
}

/** Ultima notificare SMS per copil — folosit de badge-ul „Notificat azi" din De notificat/Situația plăților. */
export function useSmsLastNotified(): SmsLastNotifiedData {
  const [byChild, setByChild] = useState<Record<string, SmsLastNotifiedView>>({});
  // M11: un token de cerere ignoră un răspuns vechi sosit după unul mai nou — fostul `cancelled`
  // proteja doar eroarea de la montare, nu și un succes sosit după un refresh() mai nou.
  const requestIdRef = useRef(0);

  async function refresh() {
    const requestId = ++requestIdRef.current;
    const response = (await requestJson('/api/sms-last-notified')) as Record<string, SmsLastNotifiedView>;
    if (requestId === requestIdRef.current) setByChild(response);
  }

  useEffect(() => {
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function notifiedToday(childId: string, todayStr: string): boolean {
    const entry = byChild[childId];
    if (!entry) return false;
    // entry.at e UTC (created_at scris cu toISOString() pe server); o simplă felie de string
    // ar compara data UTC, nu cea locală — un SMS trimis la 00:30 local n-ar mai apărea „azi”.
    return isoDateOf(new Date(entry.at)) === todayStr;
  }

  return { byChild, refresh, notifiedToday };
}
