import { cents } from './money.mjs';

/** @typedef {'MDL' | 'EUR'} Currency */
/** @typedef {Record<string, number>} ExchangeRates cheie YYYY-MM-DD, valoare = câte MDL fac 1 EUR */

export const DEFAULT_EXCHANGE_RATES = /** @type {ExchangeRates} */ ({});

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Completează și validează o hartă parțială/coruptă: orice cheie care nu e o
 * dată YYYY-MM-DD sau orice valoare care nu e un număr pozitiv finit se
 * elimină, fără să arunce — un curs stricat în settings nu trebuie să oprească
 * nimic, doar să lipsească (eurToMdlRate cade pe cel mai recent curs bun).
 * @param {unknown} overrides
 * @returns {ExchangeRates}
 */
export function clampExchangeRates(overrides) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return {};
  /** @type {ExchangeRates} */
  const result = {};
  for (const [key, value] of Object.entries(overrides)) {
    const rate = Number(value);
    if (!DATE_KEY.test(key) || !Number.isFinite(rate) || rate <= 0) continue;
    const [year, month, day] = key.split('-').map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    result[key] = rate;
  }
  return result;
}

/**
 * @param {string | undefined | null} json
 * @returns {ExchangeRates}
 */
export function parseExchangeRates(json) {
  if (!json) return {};
  try {
    return clampExchangeRates(JSON.parse(json));
  } catch {
    return {};
  }
}

/**
 * Cursul zilei exacte, sau al celei mai recente zile anterioare cunoscute —
 * niciodată al unei zile ulterioare (ar însemna să folosești un curs din
 * viitor pentru o plată din trecut).
 * @param {ExchangeRates} rates
 * @param {string} date YYYY-MM-DD
 * @returns {number | undefined}
 */
export function eurToMdlRate(rates, date) {
  if (Object.hasOwn(rates, date)) return rates[date];
  const earlierDates = Object.keys(rates)
    .filter(known => known <= date)
    .sort();
  return earlierDates.length ? rates[earlierDates.at(-1)] : undefined;
}

/**
 * Cursul celei mai recente zile cunoscute, indiferent de dată — folosit pentru
 * sume încă neîncasate (proiecție „cât ar costa azi", nu un fapt istoric).
 * @param {ExchangeRates} rates
 * @returns {number | undefined}
 */
export function latestKnownRate(rates) {
  const dates = Object.keys(rates).sort();
  return dates.length ? rates[dates.at(-1)] : undefined;
}

/**
 * @param {number} amount
 * @param {Currency} fromCurrency
 * @param {Currency} toCurrency
 * @param {number | undefined} rate MDL per 1 EUR, deja rezolvat de apelant (eurToMdlRate sau latestKnownRate)
 * @returns {number | null} null când monedele diferă și n-a fost dat un curs
 */
export function convertAmount(amount, fromCurrency, toCurrency, rate) {
  if (fromCurrency === toCurrency) return amount;
  if (rate == null) return null;
  if (fromCurrency === 'EUR' && toCurrency === 'MDL') return cents(amount * rate) / 100;
  if (fromCurrency === 'MDL' && toCurrency === 'EUR') return cents(amount / rate) / 100;
  throw new Error(`Monedă nesuportată: ${fromCurrency} → ${toCurrency}`);
}

/**
 * @param {string} dateKey YYYY-MM-DD
 * @returns {string} DD.MM.YYYY, formatul cerut de query-ul BNM
 */
export function bnmDateParam(dateKey) {
  const [year, month, day] = dateKey.split('-');
  return `${day}.${month}.${year}`;
}

/**
 * Citește valoarea EUR din răspunsul XML al BNM
 * (GET /ro/official_exchange_rates?get_xml=1&date=DD.MM.YYYY).
 * @param {string} xmlText
 * @returns {number | null}
 */
export function parseBnmEurRate(xmlText) {
  const match = /<Valute[^>]*>(?:(?!<\/Valute>)[\s\S])*?<CharCode>EUR<\/CharCode>[\s\S]*?<Value>([\d.,]+)<\/Value>[\s\S]*?<\/Valute>/.exec(
    xmlText || '',
  );
  if (!match) return null;
  const rate = Number(match[1].replace(',', '.'));
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}
