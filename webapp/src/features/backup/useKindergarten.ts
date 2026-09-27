import { useEffect, useState } from 'react';
import { requestJson } from '@shared/api/session';

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
  settings: KindergartenSettings | null;
  save: (next: KindergartenSettings) => Promise<KindergartenSettings>;
}

/** Datele grădiniței (16a) — un singur obiect în settings, folosit și de confirmarea de plată. */
export function useKindergarten(): KindergartenData {
  const [settings, setSettings] = useState<KindergartenSettings | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      setSettings((await requestJson('/api/kindergarten')) as KindergartenSettings);
      setReady(true);
    })();
  }, []);

  async function save(next: KindergartenSettings) {
    const saved = (await requestJson('/api/kindergarten', next)) as KindergartenSettings;
    setSettings(saved);
    return saved;
  }

  return { ready, settings, save };
}
