import { fail } from '#core/server/errors/domain-error.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
import { parseExchangeRates, clampExchangeRates } from '#shared/domain/exchange-rates.mjs';
import { fetchBnmEurRate } from './bnm-exchange-rate.mjs';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {{ readSetting: (key: string) => string, writeSetting: (key: string, value: string) => void, fetch: typeof fetch }} dependencies
 */
export function createExchangeRatesRoutes({ readSetting, writeSetting, fetch: fetchImpl }) {
  const readRates = () => parseExchangeRates(readSetting('exchangeRates'));
  const saveRates = rates => writeSetting('exchangeRates', JSON.stringify(rates));

  return [
    { method: 'GET', path: '/api/exchange-rates', handle: () => readRates() },
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
        return after;
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
        return { ok: true, rates: after };
      },
    },
  ];
}
