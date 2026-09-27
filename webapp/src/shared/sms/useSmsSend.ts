import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@shared/api/session';
import type { SmsSendRequestView, SmsSendResultView } from './sms-types';

const REFRESH_STATUSES_DELAY_MS = 30000;

export interface SmsSendData {
  sending: boolean;
  lastResult: SmsSendResultView | null;
  send: (request: SmsSendRequestView) => Promise<SmsSendResultView>;
}

/** Trimite un lot de SMS-uri; după o trimitere reușită, o singură reîmprospătare a stărilor la 30s (raportul de livrare are întârziere). */
export function useSmsSend(): SmsSendData {
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<SmsSendResultView | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    },
    [],
  );

  async function send(request: SmsSendRequestView) {
    setSending(true);
    try {
      const result = (await requestJson('/api/sms-send', request)) as SmsSendResultView;
      setLastResult(result);
      const anySent = result.results.some(outcome => outcome.outcome === 'sent');
      if (anySent) {
        if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = setTimeout(() => {
          requestJson('/api/sms-refresh-statuses', {}).catch(() => {});
        }, REFRESH_STATUSES_DELAY_MS);
      }
      return result;
    } finally {
      setSending(false);
    }
  }

  return { sending, lastResult, send };
}
