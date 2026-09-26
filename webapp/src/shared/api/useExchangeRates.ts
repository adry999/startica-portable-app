import { useEffect, useState } from 'react';
import { requestJson } from './session';

export interface ExchangeRatesState {
  ready: boolean;
  rates: Record<string, number>;
}

interface ExchangeRatesResponse {
  rates: Record<string, number>;
  sources: Record<string, 'bnm' | 'manual'>;
}

/** Citire minimală, doar `rates` — pentru conversia lei/euro din formulare. Vezi features/backup/useExchangeRates.ts pentru ecranul Curs valutar (surse, corectare, presetări). */
export function useExchangeRates(): ExchangeRatesState {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = (await requestJson('/api/exchange-rates')) as ExchangeRatesResponse;
        setRates(response.rates);
      } catch {
        // Fără curs cunoscut, formularul tratează copilul EUR ca "niciun curs" — nu blochează ecranul.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  return { ready, rates };
}
