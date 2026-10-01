import { useCallback, useEffect, useState } from 'react';
import { requestJson } from '@shared/api/session';
import { latestKnownRate, latestKnownRateDate } from '#shared/domain/exchange-rates.mjs';
import { today, shiftDays } from '@domain/calendar-month.mjs';

export type ExchangeRateSource = 'bnm' | 'manual';
export type TodayTone = 'mint' | 'yellow' | null;

export interface PlanPreset {
  id: string;
  name: string;
  priceEur: number;
  hours?: string;
  description?: string;
}

export interface LastFiveDaysEntry {
  date: string;
  rate: number;
  source: ExchangeRateSource | undefined;
}

export interface TomorrowRate {
  date: string;
  rate: number;
  diff: number;
}

interface ExchangeRatesResponse {
  rates: Record<string, number>;
  sources: Record<string, ExchangeRateSource>;
}

type RefreshResult = { ok: true } | { ok: false; error: string };

export interface ExchangeRatesData {
  ready: boolean;
  /** M6: `ready` rămâne fals la un eșec — `status`/`failureMessage` disting „se încarcă” de „a eșuat”, ca ecranul
   * să nu rămână blocat pe „Se încarcă cursul valutar…” la nesfârșit când /api/exchange-rates sau
   * /api/plan-presets pică. */
  status: 'loading' | 'ready' | 'failed';
  failureMessage: string;
  reload: () => Promise<void>;
  rates: Record<string, number>;
  sources: Record<string, ExchangeRateSource>;
  /** Cursul zilei — sau, în weekend/sărbători, ultimul curs publicat (regula din 16-planuri-eur.md). */
  todayRate: number | undefined;
  /** Ziua căreia îi corespunde `todayRate` — poate fi anterioară azi (weekend). */
  rateDate: string | undefined;
  todayTone: TodayTone;
  lastFiveDays: LastFiveDaysEntry[];
  /** Apare doar după ce BNM a publicat cursul zilei următoare (F12). */
  tomorrow: TomorrowRate | null;
  calendarMonth: string;
  setCalendarMonth: (month: string) => void;
  backfilling: boolean;
  backfill: (days: number) => Promise<void>;
  correctToday: (rate: number) => Promise<void>;
  refreshFromBnm: () => Promise<RefreshResult>;
  presets: PlanPreset[];
  savePresets: (next: PlanPreset[]) => Promise<void>;
}

export function useExchangeRates(): ExchangeRatesData {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [sources, setSources] = useState<Record<string, ExchangeRateSource>>({});
  const [presets, setPresets] = useState<PlanPreset[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [failureMessage, setFailureMessage] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => today().slice(0, 7));
  const [backfilling, setBackfilling] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [ratesResponse, presetsResponse] = await Promise.all([
        requestJson('/api/exchange-rates') as Promise<ExchangeRatesResponse>,
        requestJson('/api/plan-presets') as Promise<PlanPreset[]>,
      ]);
      setRates(ratesResponse.rates);
      setSources(ratesResponse.sources);
      setPresets(presetsResponse);
      setStatus('ready');
    } catch (error) {
      setFailureMessage((error as Error).message);
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rateDate = latestKnownRateDate(rates);
  const todayRate = latestKnownRate(rates);
  const todayTone: TodayTone =
    rateDate === undefined
      ? null
      : sources[rateDate] === 'bnm'
        ? 'mint'
        : sources[rateDate] === 'manual'
          ? 'yellow'
          : null;

  const lastFiveDays = Object.keys(rates)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 5)
    .map(date => ({ date, rate: rates[date], source: sources[date] }));

  const tomorrowDate = shiftDays(today(), 1);
  const tomorrow: TomorrowRate | null = Object.hasOwn(rates, tomorrowDate)
    ? { date: tomorrowDate, rate: rates[tomorrowDate], diff: rates[tomorrowDate] - (todayRate ?? rates[tomorrowDate]) }
    : null;

  async function correctToday(rate: number) {
    // Corectarea vizează întotdeauna ziua calendaristică de azi, nu ultima zi cu curs cunoscut
    // (care poate fi vineri, dacă azi e weekend și BNM nu a publicat încă).
    const response = (await requestJson('/api/exchange-rates', { date: today(), rate })) as ExchangeRatesResponse;
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

  async function backfill(days: number) {
    setBackfilling(true);
    try {
      const response = (await requestJson('/api/exchange-rates/backfill', { days })) as ExchangeRatesResponse;
      setRates(response.rates);
      setSources(response.sources);
    } finally {
      setBackfilling(false);
    }
  }

  return {
    ready: status === 'ready',
    status,
    failureMessage,
    reload: load,
    rates,
    sources,
    todayRate,
    rateDate,
    todayTone,
    lastFiveDays,
    tomorrow,
    calendarMonth,
    setCalendarMonth,
    backfilling,
    backfill,
    correctToday,
    refreshFromBnm,
    presets,
    savePresets,
  };
}
