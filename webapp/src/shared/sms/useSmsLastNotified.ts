import { useEffect, useState } from 'react';
import { requestJson } from '@shared/api/session';
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

  async function refresh() {
    const response = (await requestJson('/api/sms-last-notified')) as Record<string, SmsLastNotifiedView>;
    setByChild(response);
  }

  useEffect(() => {
    let cancelled = false;
    refresh().catch(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function notifiedToday(childId: string, todayStr: string): boolean {
    const entry = byChild[childId];
    if (!entry) return false;
    return entry.at.slice(0, 10) === todayStr;
  }

  return { byChild, refresh, notifiedToday };
}
