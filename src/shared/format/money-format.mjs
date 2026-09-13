// null = sumă necunoscută, diferit de zero. Vezi obligation() din #shared/domain/tuition-obligation.mjs.
export const formatMoney = v =>
  v === null
    ? '—'
    : new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0) +
      ' lei';
