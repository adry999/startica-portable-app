import { useEffect, useState } from 'react';
import { requestJson } from '@shared/api/session';

export type TelegramScreenStatus = 'loading' | 'ready' | 'failed';

export interface TelegramStatusView {
  configured: boolean;
  connected: boolean;
  chatName: string;
  botUsername: string;
  lastRun: string;
  lastSuccess: string;
  lastError: string;
  stale: boolean;
}

export interface TelegramStatusData {
  status: TelegramScreenStatus;
  failureMessage: string;
  data: TelegramStatusView | null;
  tokenInput: string;
  setTokenInput: (value: string) => void;
  connecting: boolean;
  connect: () => Promise<void>;
  testing: boolean;
  sendTest: () => Promise<void>;
  disconnecting: boolean;
  disconnect: () => Promise<void>;
}

/** Status + acțiuni (conectare/probă/deconectare), fiecare cu refresh după succes. */
export function useTelegramStatus(): TelegramStatusData {
  const [status, setStatus] = useState<TelegramScreenStatus>('loading');
  const [failureMessage, setFailureMessage] = useState('');
  const [data, setData] = useState<TelegramStatusView | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function refreshStatus() {
    const response = (await requestJson('/api/telegram-status')) as TelegramStatusView;
    setData(response);
    setStatus('ready');
    return response;
  }

  useEffect(() => {
    let cancelled = false;
    refreshStatus().catch((error: Error) => {
      if (cancelled) return;
      setStatus('failed');
      setFailureMessage(error.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function connect() {
    setConnecting(true);
    try {
      await requestJson('/api/telegram-connect', { token: tokenInput });
      setTokenInput('');
      await refreshStatus();
    } finally {
      setConnecting(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      await requestJson('/api/telegram-test', {});
      await refreshStatus();
    } finally {
      setTesting(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await requestJson('/api/telegram-disconnect', {});
      await refreshStatus();
    } finally {
      setDisconnecting(false);
    }
  }

  return {
    status,
    failureMessage,
    data,
    tokenInput,
    setTokenInput,
    connecting,
    connect,
    testing,
    sendTest,
    disconnecting,
    disconnect,
  };
}
