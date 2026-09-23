import { bnmDateParam, parseBnmEurRate } from '#shared/domain/exchange-rates.mjs';

const BNM_ROOT = 'https://www.bnm.md/ro/official_exchange_rates';
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Cere cursul EUR→MDL oficial al BNM pentru o zi. Nu aruncă niciodată — orice
 * eșec (rețea, HTTP, XML fără EUR) întoarce `{ error }`, ca pornirea
 * serverului sau apăsarea „Reîmprospătează" să nu se blocheze.
 * @param {{ fetch: typeof fetch, date: string }} args YYYY-MM-DD
 * @returns {Promise<{ rate: number } | { error: string }>}
 */
export async function fetchBnmEurRate({ fetch: fetchImpl, date }) {
  const url = `${BNM_ROOT}?get_xml=1&date=${bnmDateParam(date)}`;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) return { error: `BNM a răspuns cu eroare HTTP ${response.status}.` };
    const xml = await response.text();
    const rate = parseBnmEurRate(xml);
    if (rate === null) return { error: 'Răspunsul BNM nu conține un curs EUR valid.' };
    return { rate };
  } catch (error) {
    return { error: 'Fără internet sau BNM indisponibil: ' + (/** @type {Error} */ (error).message || 'eroare necunoscută') };
  }
}
