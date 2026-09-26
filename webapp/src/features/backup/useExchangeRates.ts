import { useEffect, useState } from 'react';
import { requestJson } from '@shared/api/session';
import { today } from '@domain/calendar-month.mjs';

export type ExchangeRateSource = 'bnm' | 'manual';
export type TodayTone = 'mint' | 'yellow' | null;

export interface PlanPreset {
  id: string;
  name: string;
  priceEur: number;
}

export interface LastFiveDaysEntry {
  date: string;
  rate: number;
  source: ExchangeRateSource | undefined;
}

interface ExchangeRatesResponse {
  rates: Record<string, number>;
  sources: Record<string, ExchangeRateSource>;
}

type RefreshResult = { ok: true } | { ok: false; error: string };

export interface ExchangeRatesData {
  ready: boolean;
  rates: Record<string, number>;
  sources: Record<string, ExchangeRateSource>;
  todayRate: number | undefined;
  todayTone: TodayTone;
  lastFiveDays: LastFiveDaysEntry[];
  correctToday: (rate: number) => Promise<void>;
  refreshFromBnm: () => Promise<RefreshResult>;
  presets: PlanPreset[];
  savePresets: (next: PlanPreset[]) => Promise<void>;
}

export function useExchangeRates(): ExchangeRatesData {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [sources, setSources] = useState<Record<string, ExchangeRateSource>>({});
  const [presets, setPresets] = useState<PlanPreset[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const [ratesResponse, presetsResponse] = await Promise.all([
        requestJson('/api/exchange-rates') as Promise<ExchangeRatesResponse>,
        requestJson('/api/plan-presets') as Promise<PlanPreset[]>,
      ]);
      setRates(ratesResponse.rates);
      setSources(ratesResponse.sources);
      setPresets(presetsResponse);
      setReady(true);
    })();
  }, []);

  const todayDate = today();
  const todayRate = rates[todayDate];
  const todayTone: TodayTone =
    todayRate === undefined
      ? null
      : sources[todayDate] === 'bnm'
        ? 'mint'
        : sources[todayDate] === 'manual'
          ? 'yellow'
          : null;

  const lastFiveDays = Object.keys(rates)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 5)
    .map(date => ({ date, rate: rates[date], source: sources[date] }));

  async function correctToday(rate: number) {
    const response = (await requestJson('/api/exchange-rates', { date: todayDate, rate })) as ExchangeRatesResponse;
    setRates(response.rates);
    setSources(response.sources);
  }

  async function refreshFromBnm(): Promise<RefreshResult> {
    const response = (await requestJson('/api/exchange-rates/refresh', {})) as
      ({ ok: true } & ExchangeRatesResponse) | { ok: false; error: string };
    if (!response.ok) return { ok: false, error: response.error };
    setRates(response.rates);
    setSources(response.sources);
    return { ok: true };
  }

  async function savePresets(next: PlanPreset[]) {
    const saved = (await requestJson('/api/plan-presets', next)) as PlanPreset[];
    setPresets(saved);
  }

  return {
    ready,
    rates,
    sources,
    todayRate,
    todayTone,
    lastFiveDays,
    correctToday,
    refreshFromBnm,
    presets,
    savePresets,
  };
}
