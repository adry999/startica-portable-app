import { useEffect, useState } from 'react';
import { requestJson } from './session';

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

export interface KindergartenState {
  ready: boolean;
  settings: KindergartenSettings | null;
}

/**
 * Citire minimală a datelor grădiniței — pentru antetul documentelor tipărite
 * (confirmarea de plată, situația plăților). Vezi features/backup/useKindergarten.ts
 * pentru ecranul de editare (fila „Grădinița”).
 */
export function useKindergarten(): KindergartenState {
  const [settings, setSettings] = useState<KindergartenSettings | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setSettings((await requestJson('/api/kindergarten')) as KindergartenSettings);
      } catch {
        // Fără datele grădiniței, antetul documentului tipărit rămâne generic — nu blochează ecranul.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  return { ready, settings };
}
