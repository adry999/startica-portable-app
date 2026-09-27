import { useEffect, useState } from 'react';
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

  async function refresh() {
    const response = (await requestJson('/api/sms-status')) as SmsStatusView;
    setData(response);
    setStatus('ready');
    return response;
  }

  useEffect(() => {
    let cancelled = false;
    refresh().catch((error: Error) => {
      if (cancelled) return;
      setStatus('failed');
      setFailureMessage(error.message);
    });
    return () => {
      cancelled = true;
    };
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
