import { useCallback, useEffect, useState } from 'react';
import { requestJson } from '@shared/api/session';
import { toUserError } from '@shared/api/to-user-error';

export type ReceiptFormat = 'a5' | 'a4-third';

export interface KindergartenSettings {
  name: string;
  displayName: string;
  idno: string;
  administrator: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  iban: string;
  bank: string;
  nextReceiptNumber: number;
  receiptFormat: ReceiptFormat;
  signatureLabel: string;
  footerNote: string;
  logoDataUrl: string;
}

export interface KindergartenData {
  ready: boolean;
  /** M6: `ready` rămâne fals la un eșec — `status`/`failureMessage` disting „se încarcă” de „a eșuat”, ca fila
   * „Grădinița” să nu rămână blocată pe LoadingState la nesfârșit când /api/kindergarten pică. */
  status: 'loading' | 'ready' | 'failed';
  failureMessage: string;
  reload: () => Promise<void>;
  settings: KindergartenSettings | null;
  save: (next: KindergartenSettings) => Promise<KindergartenSettings>;
}

/** Datele grădiniței (16a) — un singur obiect în settings, folosit și de confirmarea de plată. */
export function useKindergarten(): KindergartenData {
  const [settings, setSettings] = useState<KindergartenSettings | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [failureMessage, setFailureMessage] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setSettings((await requestJson('/api/kindergarten')) as KindergartenSettings);
      setStatus('ready');
    } catch (error) {
      setFailureMessage(toUserError(error));
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: KindergartenSettings) {
    const saved = (await requestJson('/api/kindergarten', next)) as KindergartenSettings;
    setSettings(saved);
    return saved;
  }

  return { ready: status === 'ready', status, failureMessage, reload: load, settings, save };
}
