// Cursul valutar se scrie cu 4 zecimale (standardul BNM), nu cu 2 ca banii —
// vezi docs/design/FEEDBACK.md „Curs valutar (12a)".
/**
 * @param {number | null | undefined} rate
 */
export const formatRate = rate =>
  rate == null
    ? '—'
    : new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(rate);
