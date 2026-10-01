// null = sumă necunoscută, diferit de zero. Vezi obligation() din #shared/domain/tuition-obligation.mjs.
/**
 * @param {number | null} v
 * @param {import('#shared/contracts/record-types.mjs').Currency} [currency]
 */
export const formatMoney = (v, currency = 'MDL') =>
  v === null
    ? '—'
    : new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0) +
      (currency === 'EUR' ? ' €' : ' lei');

/**
 * Valoarea unui câmp numeric editabil (ex. suma de repartizare dintr-o achitare) — "1234.50", fără
 * separator de mii și fără sufix de monedă, spre deosebire de `formatMoney` (text afișat, nu input).
 * @param {number} v
 */
export const formatMoneyInput = v => v.toFixed(2);
