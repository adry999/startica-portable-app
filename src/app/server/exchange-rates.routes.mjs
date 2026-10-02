import { fail } from '#core/server/errors/domain-error.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
import {
  parseExchangeRates,
  clampExchangeRates,
  parseExchangeRateSources,
  clampExchangeRateSources,
} from '#shared/domain/exchange-rates.mjs';
import { fetchBnmEurRate } from './bnm-exchange-rate.mjs';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const MAX_BACKFILL_DAYS = 90;

/**
 * @param {{ readSetting: (key: string) => string, writeSetting: (key: string, value: string) => void, fetch: typeof fetch, backfill: (days: number) => Promise<void> }} dependencies
 */
export function createExchangeRatesRoutes({ readSetting, writeSetting, fetch: fetchImpl, backfill }) {
  const readRates = () => parseExchangeRates(readSetting('exchangeRates'));
  const saveRates = rates => writeSetting('exchangeRates', JSON.stringify(rates));
  const readSources = () => parseExchangeRateSources(readSetting('exchangeRateSources'));
  const saveSources = sources => writeSetting('exchangeRateSources', JSON.stringify(sources));

  return [
    { method: 'GET', path: '/api/exchange-rates', handle: () => ({ rates: readRates(), sources: readSources() }) },
    {
      method: 'POST',
      path: '/api/exchange-rates',
      /** @param {{ body: any }} request */
      handle: ({ body }) => {
        const date = body?.date;
        const rate = Number(body?.rate);
        if (!DATE_KEY.test(date)) fail('Dată invalidă. Folosește AAAA-LL-ZZ.');
        if (!Number.isFinite(rate) || rate <= 0) fail('Curs invalid. Folosește un număr pozitiv.');
        const after = clampExchangeRates({ ...readRates(), [date]: rate });
        saveRates(after);
        const afterSources = clampExchangeRateSources({ ...readSources(), [date]: 'manual' });
        saveSources(afterSources);
        return { rates: after, sources: afterSources };
      },
    },
    {
      method: 'POST',
      path: '/api/exchange-rates/refresh',
      handle: async () => {
        const date = today();
        const result = await fetchBnmEurRate({ fetch: fetchImpl, date });
        if ('error' in result) return { ok: false, error: result.error };
        const after = clampExchangeRates({ ...readRates(), [date]: result.rate });
        saveRates(after);
        const afterSources = clampExchangeRateSources({ ...readSources(), [date]: 'bnm' });
        saveSources(afterSources);
        return { ok: true, rates: after, sources: afterSources };
      },
    },
    {
      method: 'POST',
      path: '/api/exchange-rates/import',
      // PROMPT-9 §8: folosit doar de scripts/migrate/ (mutarea cursului în baza comună) —
      // adaugă istoricul unei filiale vechi peste cel curent, păstrând provenența (bnm/manual)
      // fiecărei zile, spre deosebire de POST /api/exchange-rates (o singură zi, mereu „manual”).
      // Adiție, nu înlocuire: o zi deja prezentă rămâne cum era dacă importul n-o atinge, iar
      // niciun istoric nu se șterge vreodată aici — doar se completează.
      /** @param {{ body: any }} request */
      handle: ({ body }) => {
        if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Corp invalid.');
        const importedRates = clampExchangeRates(body.rates);
        const importedSources = clampExchangeRateSources(body.sources);
        // Ziua deja cunoscută aici (o corectare manuală, de exemplu) câștigă față de import —
        // la fel ca fetchMissingRatesInRange mai sus (create-branch-context.mjs): importul
        // completează doar ce lipsește, nu suprascrie tăcut ce există deja.
        const after = clampExchangeRates({ ...importedRates, ...readRates() });
        saveRates(after);
        const afterSources = clampExchangeRateSources({ ...importedSources, ...readSources() });
        saveSources(afterSources);
        return { rates: after, sources: afterSources };
      },
    },
    {
      method: 'POST',
      path: '/api/exchange-rates/backfill',
      // F12 (FEEDBACK-01-10.md): „Vezi încă N zile” din calendarul lunar — extinde istoricul
      // înapoi de la cea mai veche zi cunoscută, nu doar golurile până la azi.
      /** @param {{ body: any }} request */
      handle: async ({ body }) => {
        const days = Number(body?.days);
        if (!Number.isInteger(days) || days <= 0 || days > MAX_BACKFILL_DAYS) {
          fail(`Numărul de zile trebuie să fie întreg, între 1 și ${MAX_BACKFILL_DAYS}.`);
        }
        await backfill(days);
        return { rates: readRates(), sources: readSources() };
      },
    },
  ];
}
