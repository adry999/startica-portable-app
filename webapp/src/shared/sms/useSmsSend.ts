import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@shared/api/session';
import type { SmsSendRequestView, SmsSendResultView } from './sms-types';

const REFRESH_STATUSES_DELAY_MS = 30000;

/** Ce dă apelantul (fără `requestId`) — hook-ul e cel care ține identificatorul de lot (M10). */
export type SmsSendInput = Omit<SmsSendRequestView, 'requestId'>;

export interface SmsSendData {
  sending: boolean;
  lastResult: SmsSendResultView | null;
  send: (request: SmsSendInput) => Promise<SmsSendResultView>;
}

/** @returns true dacă `request` e chiar lotul din `pending` (fără `requestId`) — o reluare, nu un lot nou. */
function isRetryOf(pending: SmsSendRequestView | null, request: SmsSendInput): pending is SmsSendRequestView {
  if (!pending) return false;
  const { requestId, ...rest } = pending;
  void requestId;
  return JSON.stringify(rest) === JSON.stringify(request);
}

/**
 * Trimite un lot de SMS-uri; după o trimitere reușită, o singură reîmprospătare a stărilor la 30s
 * (raportul de livrare are întârziere).
 *
 * Idempotență (M10): un lot poate dura minute (pauză între mesaje) — un timeout HTTP al clientului
 * nu înseamnă că serverul n-a trimis nimic. Ca `mutate`/`load` din `app-session-store.mjs`: `pendingRef`
 * ține corpul cu `requestId` cât operațiunea are stare necunoscută (eroare de rețea, fără status); o
 * reluare a exact aceluiași lot refolosește id-ul, ca serverul să nu retrimită. Un lot cu conținut
 * diferit (utilizatorul a schimbat selecția) primește un id nou, nu-l reia pe cel vechi.
 */
export function useSmsSend(): SmsSendData {
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<SmsSendResultView | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<SmsSendRequestView | null>(null);

  useEffect(
    () => () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    },
    [],
  );

  async function send(request: SmsSendInput) {
    setSending(true);
    const body: SmsSendRequestView = isRetryOf(pendingRef.current, request)
      ? pendingRef.current
      : { ...request, requestId: crypto.randomUUID() };
    pendingRef.current = body;
    try {
      const result = (await requestJson('/api/sms-send', body)) as SmsSendResultView;
      pendingRef.current = null;
      setLastResult(result);
      const anySent = result.results.some(outcome => outcome.outcome === 'sent');
      if (anySent) {
        if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = setTimeout(() => {
          requestJson('/api/sms-refresh-statuses', {}).catch(() => {});
        }, REFRESH_STATUSES_DELAY_MS);
      }
      return result;
    } catch (error) {
      // Fără status (eroare de rețea): lotul rămâne pending, o reluare refolosește requestId-ul;
      // cu status, serverul a decis deja — un nou apel cu acest conținut cere un id nou.
      if ((error as { status?: number | null }).status) pendingRef.current = null;
      throw error;
    } finally {
      setSending(false);
    }
  }

  return { sending, lastResult, send };
}
