import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@shared/api/session';
import type { SmsStatusView } from './sms-types';

export type SmsStatusScreenStatus = 'loading' | 'ready' | 'failed';

export interface SmsConnectInput {
  token?: string;
  sender: string;
  monthlyLimit: number | null;
}

export interface SmsStatusData {
  status: SmsStatusScreenStatus;
  failureMessage: string;
  data: SmsStatusView | null;
  connecting: boolean;
  connect: (input: SmsConnectInput) => Promise<void>;
  testing: boolean;
  sendTest: (phone: string) => Promise<void>;
  disconnecting: boolean;
  disconnect: () => Promise<void>;
  refresh: () => Promise<SmsStatusView>;
}

/** Status + acțiuni sms.md (conectare/probă/deconectare), fiecare cu refresh după succes — vezi useTelegramStatus. */
export function useSmsStatus(): SmsStatusData {
  const [status, setStatus] = useState<SmsStatusScreenStatus>('loading');
  const [failureMessage, setFailureMessage] = useState('');
  const [data, setData] = useState<SmsStatusView | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  // M11: connect/sendTest/disconnect cheamă refresh() peste cea de la montare — un token de
  // cerere ignoră un răspuns vechi sosit după unul mai nou, nu doar la eroare (fostul `cancelled`).
  const requestIdRef = useRef(0);

  async function refresh() {
    const requestId = ++requestIdRef.current;
    const response = (await requestJson('/api/sms-status')) as SmsStatusView;
    if (requestId === requestIdRef.current) {
      setData(response);
      setStatus('ready');
    }
    return response;
  }

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    requestJson('/api/sms-status')
      .then(response => {
        if (requestId !== requestIdRef.current) return;
        setData(response as SmsStatusView);
        setStatus('ready');
      })
      .catch((error: Error) => {
        if (requestId !== requestIdRef.current) return;
        setStatus('failed');
        setFailureMessage(error.message);
      });
  }, []);

  async function connect(input: SmsConnectInput) {
    setConnecting(true);
    try {
      await requestJson('/api/sms-connect', input);
      await refresh();
    } finally {
      setConnecting(false);
    }
  }

  async function sendTest(phone: string) {
    setTesting(true);
    try {
      await requestJson('/api/sms-test', { phone });
      await refresh();
    } finally {
      setTesting(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await requestJson('/api/sms-disconnect', {});
      await refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  return {
    status,
    failureMessage,
    data,
    connecting,
    connect,
    testing,
    sendTest,
    disconnecting,
    disconnect,
    refresh,
  };
}
