export const cents = value => Math.round(Number(value) * 100);
export const total = rows => rows.reduce((s, r) => s + cents(r.amount), 0) / 100;
