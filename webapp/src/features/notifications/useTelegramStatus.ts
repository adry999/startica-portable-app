import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@shared/api/session';
import { toUserError } from '@shared/api/to-user-error';

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
  // M11: connect/sendTest/disconnect cheamă refreshStatus() peste cea de la montare — un token de
  // cerere ignoră un răspuns vechi sosit după unul mai nou, nu doar la eroare (fostul `cancelled`).
  const requestIdRef = useRef(0);

  async function refreshStatus() {
    const requestId = ++requestIdRef.current;
    const response = (await requestJson('/api/telegram-status')) as TelegramStatusView;
    if (requestId === requestIdRef.current) {
      setData(response);
      setStatus('ready');
    }
    return response;
  }

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    requestJson('/api/telegram-status')
      .then(response => {
        if (requestId !== requestIdRef.current) return;
        setData(response as TelegramStatusView);
        setStatus('ready');
      })
      .catch((error: Error) => {
        if (requestId !== requestIdRef.current) return;
        setStatus('failed');
        setFailureMessage(toUserError(error));
      });
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
